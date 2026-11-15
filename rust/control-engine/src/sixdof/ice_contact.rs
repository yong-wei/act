//! T级条带冰板与有限浮冰接触。船体接触点取自冻结船形水线剖面。
//! 适用范围为平整无雪冰中的低速教学，省略碎冰间相互挤压和裂纹传播。
//! 压力面积关系及浮力地基板尺度遵循 Zhang et al. (2020),
//! https://doi.org/10.3390/app10020692 。条带化和单片矩形浮冰为教学近似。

use super::dynamics::solve_linear_6;
use super::hydrostatics::HydrostaticHull;
use super::state::{moment_from_force, normalize_quaternion, quaternion_rate, rotation_matrix};
use serde::{Deserialize, Serialize};

const WATER_DENSITY: f64 = 1025.0;
const ICE_DENSITY: f64 = 900.0;
const GRAVITY: f64 = 9.81;
pub const DEFINITION: &str = "ice-strip-contact-teaching-v1;rho=900;E=3e9;nu=.3;p0=2e6;areaExponent=-.1;finiteFloe=rigid-6dof;waterDrag=quadratic-cd1";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IceConfiguration {
    pub thickness_m: f64,
    pub flexural_strength_pa: f64,
    pub friction_coefficient: f64,
    pub contact_segments: usize,
}

impl IceConfiguration {
    pub fn validate(&self) -> Result<(), String> {
        if !self.thickness_m.is_finite() || !(0.2..=1.2).contains(&self.thickness_m)
            || !self.flexural_strength_pa.is_finite() || !(300_000.0..=700_000.0).contains(&self.flexural_strength_pa)
            || !self.friction_coefficient.is_finite() || !(0.05..=0.15).contains(&self.friction_coefficient)
            || ![64, 128].contains(&self.contact_segments)
        { return Err("冰厚、抗弯强度、摩擦系数或接触分辨率超出教学范围".into()); }
        Ok(())
    }

    pub fn flexural_rigidity_nm(&self) -> f64 {
        3.0e9 * self.thickness_m.powi(3) / (12.0 * (1.0 - 0.3f64.powi(2)))
    }

    pub fn characteristic_length_m(&self) -> f64 {
        (self.flexural_rigidity_nm() / (WATER_DENSITY * GRAVITY)).powf(0.25)
    }
}

#[derive(Debug, Clone)]
struct HullPatch {
    point: [f64; 3],
    normal: [f64; 3],
    span_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceFloe {
    position_ned: [f64; 3],
    quaternion: [f64; 4],
    velocity_ned: [f64; 3],
    angular_velocity_body: [f64; 3],
    width_m: f64,
    length_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IceState {
    fronts_north_m: Vec<f64>,
    floes: Vec<IceFloe>,
    pub broken_area_m2: f64,
    pub crushing_work_j: f64,
    pub friction_work_j: f64,
    pub fracture_work_j: f64,
    pub water_dissipation_j: f64,
    pub contact_body_work_j: f64,
    pub contact_floe_work_j: f64,
    pub last_load_body: [f64; 6],
    pub contact_count: usize,
}

#[derive(Debug, Clone)]
pub struct IceContact {
    pub configuration: IceConfiguration,
    patches: Vec<HullPatch>,
    cg_height_m: f64,
    vertical_bounds_m: [f64; 2],
    pub state: IceState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IceDiagnostics {
    broken_area_m2: f64,
    floe_count: usize,
    load_body: [f64;6],
    contact_count: usize,
    crushing_work_j: f64,
    friction_work_j: f64,
    fracture_work_j: f64,
    water_dissipation_j: f64,
    contact_body_work_j: f64,
    contact_floe_work_j: f64,
    characteristic_length_m: f64,
}

/// 仅供当前场景显示，完整浮冰状态仍由恢复点保存。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IceScene {
    fronts_north_m: Vec<f64>,
    thickness_m: f64,
    floes: Vec<IceSceneFloe>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IceSceneFloe {
    position_ned: [f64; 3],
    quaternion: [f64; 4],
    width_m: f64,
    length_m: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IceMetricPoint {
    time_s: f64,
    north_m: f64,
    east_m: f64,
    positive_motor_work_j: f64,
    forward_requested: bool,
}

/// 从实际轨迹和累计机械功复算。未到达者的单位航程能量仅供观察。
pub fn run_metrics(points: &[IceMetricPoint], terminal: Option<&IceMetricPoint>) -> Result<serde_json::Value, String> {
    if points.is_empty() || points.iter().chain(terminal).any(|point|
        [point.time_s, point.north_m, point.east_m, point.positive_motor_work_j].iter()
            .any(|value| !value.is_finite()) || point.time_s < 0.0 || point.positive_motor_work_j < 0.0)
    {
        return Err("冰区评价缺少有效的实际轨迹与机械功".into());
    }
    let mut trajectory: Vec<_> = points.iter().collect();
    if let Some(terminal) = terminal {
        let last = points.last().expect("已检查非空");
        let dt = terminal.time_s - last.time_s;
        if dt < -1e-8 || dt > 0.05 + 1e-8 || terminal.positive_motor_work_j < last.positive_motor_work_j {
            return Err("冰区结束状态必须紧接最后一份20Hz记录".into());
        }
        if dt > 1e-8 { trajectory.push(terminal); }
        else { *trajectory.last_mut().expect("已检查非空") = terminal; }
    }
    let mut distance = 0.0;
    let mut stalled = 0.0;
    let mut maximum_stalled: f64 = 0.0;
    let mut corridor_duration = 0.0;
    for (index, pair) in trajectory.windows(2).enumerate() {
        let dt = pair[1].time_s - pair[0].time_s;
        let terminal_interval = trajectory.len() > points.len() && index + 2 == trajectory.len();
        if dt <= 0.0 || dt > 0.05 + 1e-8 || (!terminal_interval && (dt - 0.05).abs() > 1e-8)
            || pair[1].positive_motor_work_j < pair[0].positive_motor_work_j {
            return Err("冰区评价需要连续20Hz记录与单调累计机械功".into());
        }
        let north_delta = pair[1].north_m - pair[0].north_m;
        distance += north_delta.hypot(pair[1].east_m - pair[0].east_m);
        if pair[1].forward_requested && north_delta / dt < 0.1 {
            stalled += dt;
            maximum_stalled = maximum_stalled.max(stalled);
        } else {
            stalled = 0.0;
        }
        if pair[1].east_m.abs() > 25.0 { corridor_duration += dt; }
    }
    let first = trajectory[0];
    let last = trajectory.last().expect("已检查非空");
    let maximum_cross_track = trajectory.iter().map(|point| point.east_m.abs()).fold(0.0, f64::max);
    let completed = last.north_m >= 800.0;
    Ok(serde_json::json!({
        "actualDistanceM": distance,
        "finalNorthM": last.north_m,
        "maximumCrossTrackM": maximum_cross_track,
        "corridorViolationDurationS": corridor_duration,
        "stallDurationS": maximum_stalled,
        "stalled": u8::from(maximum_stalled >= 10.0),
        "iceTaskCompleted": u8::from(completed),
        "eligibleForEnergyComparison": u8::from(completed && maximum_cross_track <= 25.0),
        "energyPerDistanceJPerM": if distance > 1e-8 { Some((last.positive_motor_work_j - first.positive_motor_work_j) / distance) } else { None },
    }))
}

fn dot(a: [f64; 3], b: [f64; 3]) -> f64 { (0..3).map(|i| a[i]*b[i]).sum() }
fn add(a: [f64; 3], b: [f64; 3]) -> [f64; 3] { std::array::from_fn(|i| a[i]+b[i]) }
fn subtract(a: [f64; 3], b: [f64; 3]) -> [f64; 3] { std::array::from_fn(|i| a[i]-b[i]) }
fn scale(a: [f64; 3], s: f64) -> [f64; 3] { a.map(|x| x*s) }
fn norm(a: [f64; 3]) -> f64 { dot(a,a).sqrt() }
fn rotate(r: [[f64; 3]; 3], a: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|i| dot(r[i],a))
}
fn unrotate(r: [[f64; 3]; 3], a: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|i| (0..3).map(|j| r[j][i]*a[j]).sum())
}

impl IceContact {
    pub fn new(configuration: IceConfiguration, hull: &HydrostaticHull) -> Result<Self, String> {
        configuration.validate()?;
        let level = hull.cg_waterline_height_m + configuration.thickness_m * (ICE_DENSITY/WATER_DENSITY-0.5);
        let mut intersections = Vec::new();
        for triangle in &hull.triangles {
            let points = triangle.map(|index| hull.vertices_body_m[index]);
            let normal = moment_from_force(subtract(points[1],points[0]),subtract(points[2],points[0]));
            let magnitude = norm(normal);
            let mut cuts = Vec::new();
            for (a,b) in [(0,1),(1,2),(2,0)] {
                if (points[a][2] < level) != (points[b][2] < level) {
                    let fraction = (level-points[a][2])/(points[b][2]-points[a][2]);
                    cuts.push(add(points[a],scale(subtract(points[b],points[a]),fraction)));
                }
            }
            if cuts.len()==2 && magnitude>1e-12 {
                intersections.push((scale(add(cuts[0],cuts[1]),0.5),scale(normal,1.0/magnitude),norm(subtract(cuts[1],cuts[0]))));
            }
        }
        intersections.sort_by(|a,b| a.0[1].atan2(a.0[0]).total_cmp(&b.0[1].atan2(b.0[0])));
        let perimeter: f64 = intersections.iter().map(|item| item.2).sum();
        if perimeter <= 0.0 { return Err("冰接触所需的源船形水线为空".into()); }
        let span = perimeter/configuration.contact_segments as f64;
        let mut patches = Vec::new();
        let mut distance = 0.0;
        let mut next = span/2.0;
        for (point,normal,length) in intersections {
            distance += length;
            while next <= distance && patches.len()<configuration.contact_segments {
                patches.push(HullPatch {point,normal,span_m:span});
                next += span;
            }
        }
        if patches.len()!=configuration.contact_segments { return Err("冰接触水线分段不完整".into()); }
        let vertical_bounds_m=[hull.vertices_body_m.iter().map(|point|point[2]).fold(f64::INFINITY,f64::min),
            hull.vertices_body_m.iter().map(|point|point[2]).fold(f64::NEG_INFINITY,f64::max)];
        Ok(Self {configuration,patches,cg_height_m:hull.cg_waterline_height_m,vertical_bounds_m,state:IceState {
            fronts_north_m:vec![200.0;64],floes:Vec::new(),broken_area_m2:0.0,
            crushing_work_j:0.0,friction_work_j:0.0,fracture_work_j:0.0,water_dissipation_j:0.0,
            contact_body_work_j:0.0,contact_floe_work_j:0.0,last_load_body:[0.0;6],contact_count:0,
        }})
    }

    pub fn restore(&mut self, state: IceState) -> Result<(), String> {
        let values = serde_json::to_value(&state).map_err(|error|error.to_string())?;
        fn finite(value: &serde_json::Value) -> bool {
            match value {
                serde_json::Value::Number(number)=>number.as_f64().is_some_and(f64::is_finite),
                serde_json::Value::Array(array)=>array.iter().all(finite),
                serde_json::Value::Object(object)=>object.values().all(finite),
                _=>false,
            }
        }
        if !finite(&values) || state.fronts_north_m.len()!=64 || state.floes.len()>8192
            || state.fronts_north_m.iter().any(|front| !(200.0..=720.0).contains(front))
            || state.floes.iter().any(|floe| floe.width_m<=0.0 || floe.length_m<=0.0
                || (dot_quaternion(floe.quaternion)-1.0).abs()>1e-8)
        {return Err("冰场恢复点无效".into());}
        self.state=state;
        Ok(())
    }

    pub fn floe_count(&self) -> usize { self.state.floes.len() }

    pub fn scene(&self, vessel_position: [f64; 3]) -> IceScene {
        let mut nearby: Vec<_> = self.state.floes.iter().filter(|floe|
            (floe.position_ned[0] - vessel_position[0]).abs() < 160.0
                && (floe.position_ned[1] - vessel_position[1]).abs() < 100.0).collect();
        nearby.sort_by(|a, b| {
            let distance = |floe: &IceFloe| (floe.position_ned[0] - vessel_position[0]).powi(2)
                + (floe.position_ned[1] - vessel_position[1]).powi(2);
            distance(a).total_cmp(&distance(b))
        });
        IceScene {
            fronts_north_m: self.state.fronts_north_m.clone(),
            thickness_m: self.configuration.thickness_m,
            floes: nearby.into_iter().take(128).map(|floe| IceSceneFloe {
                position_ned: floe.position_ned,
                quaternion: floe.quaternion,
                width_m: floe.width_m,
                length_m: floe.length_m,
            }).collect(),
        }
    }

    pub fn diagnostics(&self) -> IceDiagnostics {
        IceDiagnostics {broken_area_m2:self.state.broken_area_m2,floe_count:self.floe_count(),
            load_body:self.state.last_load_body,contact_count:self.state.contact_count,
            crushing_work_j:self.state.crushing_work_j,friction_work_j:self.state.friction_work_j,
            fracture_work_j:self.state.fracture_work_j,water_dissipation_j:self.state.water_dissipation_j,
            contact_body_work_j:self.state.contact_body_work_j,contact_floe_work_j:self.state.contact_floe_work_j,
            characteristic_length_m:self.configuration.characteristic_length_m()}
    }

    /// RK船体推进后求非穿透塑性冲量，质量阵包含一次实际附加质量。
    /// 各冲量在船体和浮冰间等大反向，摩擦冲量不越过相对速度零点。
    pub fn step(&mut self, dt: f64, position: [f64;3], quaternion: [f64;4],
        velocity: &mut [f64;6], mass: [[f64;6];6], current_ned: [f64;3]) -> Result<(),String> {
        let rotation=rotation_matrix(quaternion);
        let center=[position[0],position[1],position[2]-self.cg_height_m];
        self.state.last_load_body=[0.0;6];
        self.state.contact_count=0;
        let width=120.0/64.0;
        let h=self.configuration.thickness_m;
        let lc=self.configuration.characteristic_length_m();
        let break_length=std::f64::consts::PI*lc/(2.0f64.sqrt()*2.0);
        for patch in &self.patches {
            let point=add(center,rotate(rotation,patch.point));
            let normal=rotate(rotation,patch.normal);
            if point[0]<200.0 || point[0]>700.0 || point[1].abs()>60.0 || point[2].abs()>h+1.0 {continue;}
            let first=((point[1]-patch.span_m/2.0+60.0)/width).floor().max(0.0) as usize;
            let last=((point[1]+patch.span_m/2.0+60.0)/width).floor().min(63.0) as usize;
            for band in first..=last {
                let penetration=point[0]-self.state.fronts_north_m[band];
                if penetration<=0.0 || normal[0]<=0.0 {continue;}
                let area=width*penetration.min(h);
                let pressure=2.0e6*area.max(0.01).powf(-0.1);
                let force=pressure*area;
                let impulse=body_contact_impulse(velocity,mass,patch.point,patch.normal,force*dt);
                let work=apply_body_impulse(velocity,mass,patch.point,scale(patch.normal,-impulse),&mut self.state.last_load_body,dt);
                self.state.contact_body_work_j+=work;
                self.state.crushing_work_j+=(-work).max(0.0);
                self.state.contact_count+=usize::from(impulse>0.0);
                let local_velocity=point_velocity(*velocity,patch.point);
                let tangent=subtract(local_velocity,scale(patch.normal,dot(local_velocity,patch.normal)));
                let tangent_speed=norm(tangent);
                if tangent_speed>1e-12 {
                    let direction=scale(tangent,1.0/tangent_speed);
                    let friction=(self.configuration.friction_coefficient*impulse)
                        .min(tangent_speed/contact_inverse_mass(mass,patch.point,direction));
                    let work=apply_body_impulse(velocity,mass,patch.point,scale(direction,-friction),&mut self.state.last_load_body,dt);
                    self.state.contact_body_work_j+=work;
                    self.state.friction_work_j+=(-work).max(0.0);
                }
                // 浮力地基条带板的自由边最大应力近似，先满足弯曲破坏再推进冰缘。
                let vertical_force=force*normal[2].abs();
                let stress=6.0*vertical_force*lc*(-std::f64::consts::PI/4.0).exp()/(width*h*h);
                if impulse>0.0 && stress>=self.configuration.flexural_strength_pa {
                    let start=self.state.fronts_north_m[band];
                    let length=break_length.min(700.0-start);
                    if length>0.0 {
                        self.state.fronts_north_m[band]+=length;
                        self.state.broken_area_m2+=width*length;
                        self.state.floes.push(IceFloe {position_ned:[start+length/2.0,-60.0+(band as f64+0.5)*width,
                            h*(ICE_DENSITY/WATER_DENSITY-0.5)],quaternion:[1.0,0.0,0.0,0.0],
                            velocity_ned:[0.0;3],angular_velocity_body:[0.0;3],width_m:width,length_m:length});
                        // 接触耗散中的弯曲破坏份额单列，避免重复计入能量总额。
                        let bending_stiffness=self.configuration.flexural_rigidity_nm()*width/(2.0f64.sqrt()*lc.powi(3));
                        let fracture=(0.5*vertical_force*vertical_force/bending_stiffness).min((-work).max(0.0));
                        self.state.fracture_work_j+=fracture;
                        self.state.crushing_work_j-=fracture;
                    }
                }
            }
        }
        for floe in &mut self.state.floes {
            advance_floe(floe,h,dt,current_ned,&mut self.state.water_dissipation_j)?;
            let relative=unrotate(rotation,subtract(floe.position_ned,center));
            if relative[0].abs()>120.0 || relative[1].abs()>40.0 {continue;}
            let floe_rotation=rotation_matrix(floe.quaternion);
            for corner in [[-0.5,-0.5],[-0.5,0.5],[0.5,-0.5],[0.5,0.5]] {
                let arm=[corner[0]*floe.length_m,corner[1]*floe.width_m,0.0];
                let world=add(floe.position_ned,rotate(floe_rotation,arm));
                let body=unrotate(rotation,subtract(world,center));
                if body[2]<self.vertical_bounds_m[0] || body[2]>self.vertical_bounds_m[1] {continue;}
                let nearest=self.patches.iter().map(|patch| {
                    let horizontal=norm([patch.normal[0],patch.normal[1],0.0]);
                    (dot(subtract(body,patch.point),[patch.normal[0],patch.normal[1],0.0])/horizontal,patch)
                })
                    .max_by(|a,b|a.0.total_cmp(&b.0)).ok_or("缺少船形接触面")?;
                if nearest.0>=0.0 {continue;}
                let normal=nearest.1.normal;
                let contact_body=body;
                let normal_world=rotate(rotation,normal);
                let body_point_velocity=rotate(rotation,point_velocity(*velocity,contact_body));
                let floe_point_velocity=add(floe.velocity_ned,rotate(floe_rotation,
                    moment_from_force(floe.angular_velocity_body,arm)));
                let relative_velocity=subtract(body_point_velocity,floe_point_velocity);
                let closing=dot(relative_velocity,normal_world);
                if closing<=0.0 {continue;}
                let inverse=contact_inverse_mass(mass,contact_body,normal)
                    +floe_contact_inverse_mass(floe,h,arm,unrotate(floe_rotation,normal_world));
                let area=(floe.width_m*h/4.0).max(0.01);
                let maximum=2.0e6*area.powf(-0.1)*area*dt;
                let impulse=(closing/inverse).min(maximum);
                let body_work=apply_body_impulse(velocity,mass,contact_body,scale(normal,-impulse),&mut self.state.last_load_body,dt);
                let floe_work=apply_floe_impulse(floe,h,arm,scale(unrotate(floe_rotation,normal_world),impulse));
                self.state.contact_body_work_j+=body_work;
                self.state.contact_floe_work_j+=floe_work;
                self.state.crushing_work_j+=(-(body_work+floe_work)).max(0.0);
                self.state.contact_count+=1;
                let after_relative=subtract(rotate(rotation,point_velocity(*velocity,contact_body)),
                    add(floe.velocity_ned,rotate(floe_rotation,moment_from_force(floe.angular_velocity_body,arm))));
                let tangent=subtract(after_relative,scale(normal_world,dot(after_relative,normal_world)));
                let tangent_speed=norm(tangent);
                if tangent_speed>1e-12 {
                    let direction=scale(tangent,1.0/tangent_speed);
                    let body_direction=unrotate(rotation,direction);
                    let floe_direction=unrotate(floe_rotation,direction);
                    let inverse=contact_inverse_mass(mass,contact_body,body_direction)
                        +floe_contact_inverse_mass(floe,h,arm,floe_direction);
                    let friction=(self.configuration.friction_coefficient*impulse).min(tangent_speed/inverse);
                    let body_work=apply_body_impulse(velocity,mass,contact_body,scale(body_direction,-friction),&mut self.state.last_load_body,dt);
                    let floe_work=apply_floe_impulse(floe,h,arm,scale(floe_direction,friction));
                    self.state.contact_body_work_j+=body_work;
                    self.state.contact_floe_work_j+=floe_work;
                    self.state.friction_work_j+=(-(body_work+floe_work)).max(0.0);
                }
            }
        }
        if velocity.iter().chain(self.state.last_load_body.iter()).any(|value|!value.is_finite()) {
            return Err("冰接触产生非有限状态".into());
        }
        Ok(())
    }
}

fn dot_quaternion(q:[f64;4])->f64 {q.iter().map(|value|value*value).sum()}
fn point_velocity(velocity:[f64;6],arm:[f64;3])->[f64;3] {
    add([velocity[0],velocity[1],velocity[2]],moment_from_force([velocity[3],velocity[4],velocity[5]],arm))
}
fn generalized(arm:[f64;3],force:[f64;3])->[f64;6] {
    let moment=moment_from_force(arm,force);
    [force[0],force[1],force[2],moment[0],moment[1],moment[2]]
}
fn contact_inverse_mass(mut mass:[[f64;6];6],arm:[f64;3],normal:[f64;3])->f64 {
    let jacobian=generalized(arm,normal);
    let response=solve_linear_6(&mut mass,jacobian);
    (0..6).map(|axis|jacobian[axis]*response[axis]).sum()
}
fn body_contact_impulse(velocity:&[f64;6],mass:[[f64;6];6],arm:[f64;3],normal:[f64;3],maximum:f64)->f64 {
    (dot(point_velocity(*velocity,arm),normal).max(0.0)/contact_inverse_mass(mass,arm,normal)).min(maximum)
}
fn apply_body_impulse(velocity:&mut [f64;6],mut mass:[[f64;6];6],arm:[f64;3],impulse:[f64;3],
    load:&mut [f64;6],dt:f64)->f64 {
    let momentum=generalized(arm,impulse);
    let delta=solve_linear_6(&mut mass,momentum);
    let work=(0..6).map(|axis|momentum[axis]*(velocity[axis]+0.5*delta[axis])).sum();
    for axis in 0..6 {velocity[axis]+=delta[axis];load[axis]+=momentum[axis]/dt;}
    work
}
fn floe_mass_inertia(floe:&IceFloe,h:f64)->(f64,[f64;3]) {
    let mass=ICE_DENSITY*floe.width_m*floe.length_m*h;
    (mass,[mass*(floe.width_m.powi(2)+h*h)/12.0,mass*(floe.length_m.powi(2)+h*h)/12.0,
        mass*(floe.width_m.powi(2)+floe.length_m.powi(2))/12.0])
}
fn floe_contact_inverse_mass(floe:&IceFloe,h:f64,arm:[f64;3],normal:[f64;3])->f64 {
    let (mass,inertia)=floe_mass_inertia(floe,h);
    let moment=moment_from_force(arm,normal);
    1.0/mass+(0..3).map(|axis|moment[axis].powi(2)/inertia[axis]).sum::<f64>()
}
fn apply_floe_impulse(floe:&mut IceFloe,h:f64,arm:[f64;3],impulse_body:[f64;3])->f64 {
    let (mass,inertia)=floe_mass_inertia(floe,h);
    let impulse=rotate(rotation_matrix(floe.quaternion),impulse_body);
    let moment=moment_from_force(arm,impulse_body);
    let mut work=0.0;
    for axis in 0..3 {
        let linear=impulse[axis]/mass;
        let angular=moment[axis]/inertia[axis];
        work+=impulse[axis]*(floe.velocity_ned[axis]+linear/2.0)
            +moment[axis]*(floe.angular_velocity_body[axis]+angular/2.0);
        floe.velocity_ned[axis]+=linear;
        floe.angular_velocity_body[axis]+=angular;
    }
    work
}
fn advance_floe(floe:&mut IceFloe,h:f64,dt:f64,current:[f64;3],dissipation:&mut f64)->Result<(),String> {
    let (mass,inertia)=floe_mass_inertia(floe,h);
    let area=floe.width_m*floe.length_m;
    let rotation=rotation_matrix(floe.quaternion);
    let hull=HydrostaticHull {cg_waterline_height_m:0.0,
        vertices_body_m:vec![[-floe.length_m/2.0,-floe.width_m/2.0,-h/2.0],
            [floe.length_m/2.0,-floe.width_m/2.0,-h/2.0],[floe.length_m/2.0,floe.width_m/2.0,-h/2.0],
            [-floe.length_m/2.0,floe.width_m/2.0,-h/2.0],[-floe.length_m/2.0,-floe.width_m/2.0,h/2.0],
            [floe.length_m/2.0,-floe.width_m/2.0,h/2.0],[floe.length_m/2.0,floe.width_m/2.0,h/2.0],
            [-floe.length_m/2.0,floe.width_m/2.0,h/2.0]],
        triangles:vec![[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],
            [1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]};
    let body_velocity=unrotate(rotation,floe.velocity_ned);
    let mut y=Vec::from(floe.position_ned);
    y.extend(floe.quaternion);
    y.extend(body_velocity);
    y.extend(floe.angular_velocity_body);
    super::integrator::rk4_step(0.0,&mut y,dt,|_,values,derivatives| {
        let quaternion=normalize_quaternion([values[3],values[4],values[5],values[6]]);
        let velocity=[values[7],values[8],values[9]];
        let angular=[values[10],values[11],values[12]];
        let truth=super::state::TruthState {position_ned:[0.0,0.0,values[2]],quaternion,
            ..Default::default()};
        let restoring=hull.evaluate(&truth,mass,WATER_DENSITY).restoring_body;
        let centripetal=moment_from_force(angular,velocity);
        let gyro=moment_from_force(angular,std::array::from_fn(|axis|inertia[axis]*angular[axis]));
        derivatives[..3].copy_from_slice(&rotate(rotation_matrix(quaternion),velocity));
        derivatives[3..7].copy_from_slice(&quaternion_rate(quaternion,angular));
        for axis in 0..3 {
            derivatives[7+axis]=-restoring[axis]/mass-centripetal[axis];
            derivatives[10+axis]=(-restoring[3+axis]-gyro[axis])/inertia[axis];
        }
    }).map_err(|error|format!("浮冰积分失败 {error:?}"))?;
    floe.position_ned=[y[0],y[1],y[2]];
    floe.quaternion=normalize_quaternion([y[3],y[4],y[5],y[6]]);
    floe.velocity_ned=rotate(rotation_matrix(floe.quaternion),[y[7],y[8],y[9]]);
    floe.angular_velocity_body=[y[10],y[11],y[12]];
    let rotation=rotation_matrix(floe.quaternion);
    let relative=unrotate(rotation,subtract(floe.velocity_ned,current));
    let projected=[floe.width_m*h,floe.length_m*h,area];
    let mut drag_body=[0.0;3];
    for axis in 0..3 {
        let coefficient=0.5*WATER_DENSITY*projected[axis]/mass;
        // 二次阻力精确衰减，避免极薄浮冰因显式阻力过冲而产生能量。
        let next=relative[axis]/(1.0+coefficient*relative[axis].abs()*dt);
        drag_body[axis]=mass*(next-relative[axis]);
        *dissipation+=0.5*mass*(relative[axis].powi(2)-next.powi(2));
    }
    floe.velocity_ned=add(floe.velocity_ned,scale(rotate(rotation,drag_body),1.0/mass));
    for axis in 0..3 {
        let before=floe.angular_velocity_body[axis];
        floe.angular_velocity_body[axis]/=1.0+dt*before.abs();
        *dissipation+=0.5*inertia[axis]*(before.powi(2)-floe.angular_velocity_body[axis].powi(2));
    }
    if floe.position_ned.iter().chain(&floe.velocity_ned).any(|value|!value.is_finite()) {
        return Err("浮冰状态无效".into());
    }
    Ok(())
}
