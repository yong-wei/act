/**
 * 航向约定适配（平台运动学 → 场景视觉管线）。
 *
 * 平台运动学（Rust 数值内核与各实验自有积分）统一以
 *   forward = (cos h, 0, sin h)
 * 积分航向，角度单位为度；场景视觉管线（尾迹 wake-trail、预设镜头 camera-shots）
 * 钉死的约定是
 *   forward = (sin h', 0, cos h')
 * 弧度制。两者互为镜像而非固定偏置（h' = π/2 − h），任何常量偏置都无法调和：
 * 直接透传会让尾迹发射锚点与预设镜头相对船体错开 90°，并在转向时反向旋转。
 *
 * 所有实验把航向喂给管线采样器（WakeTrailRig 的 shipTransform、
 * StayPutCameraController 的 headingSampler）时必须经过此适配；
 * 船模自身的 rotation.y 约定（各实验按模型轴向补偿）不在此列。
 */
export const platformHeadingToSceneRad = (headingDeg: number): number =>
  Math.PI / 2 - (headingDeg * Math.PI) / 180;
