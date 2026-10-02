import type { PublishedPropulsionAnchor } from './types';

/** 从已接收的同版本独立接口提取；完整接口与出处仍保留在不可变模型包。 */
export const RELEASED_PROPULSION_ANCHORS: Readonly<Record<string, readonly PublishedPropulsionAnchor[]>> = {
  'lng-changheng': [
    {'id': 'ACT.Propeller.port','proxyNode': 'PropulsorAnchor_1','lodNode': 'ACT.Propeller.port','positionModelM': [-138.60000610351562,-7.25,-8.399999618530273],'shaftAxisModel': [1,0,0],'diameterM': 6.5,'immersionM': 7.25,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
    {'id': 'ACT.Propeller.starboard','proxyNode': 'PropulsorAnchor_2','lodNode': 'ACT.Propeller.starboard','positionModelM': [-138.60000610351562,-7.25,8.399999618530273],'shaftAxisModel': [1,0,0],'diameterM': 6.5,'immersionM': 7.25,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
  ],
  'msc-tessa': [
    {'id': 'ACT.Propeller','proxyNode': 'PropulsorAnchor_1','lodNode': 'ACT.Propeller','positionModelM': [-189.5,-9.199999809265137,0],'shaftAxisModel': [1,0,0],'diameterM': 10.4,'immersionM': 9.199999809265137,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
  ],
  'xue-long-2': [
    {'id': 'XL2_PROP_P','proxyNode': 'PropulsorAnchor_1','lodNode': 'XL2_PROP_P','positionModelM': [-52.650001525878906,-5.850000381469727,-5],'shaftAxisModel': [1,0,0],'diameterM': 4.25,'immersionM': 5.850000381469727,'azimuthPivotModelM': [-55,-2.700000047683716,-5],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'PUBLISHED_DIAMETER; LOCATION_DESIGN_APPROXIMATION'}},
    {'id': 'XL2_PROP_S','proxyNode': 'PropulsorAnchor_2','lodNode': 'XL2_PROP_S','positionModelM': [-52.650001525878906,-5.850000381469727,5],'shaftAxisModel': [1,0,0],'diameterM': 4.25,'immersionM': 5.850000381469727,'azimuthPivotModelM': [-55,-2.700000047683716,5],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'PUBLISHED_DIAMETER; LOCATION_DESIGN_APPROXIMATION'}},
  ],
  'adora-magic-city': [
    {'id': 'AMC_OUT_PROP_P','proxyNode': 'PropulsorAnchor_1','lodNode': 'AMC_OUT_PROP_P','positionModelM': [-134.14999389648438,-6.548704624176025,-7],'shaftAxisModel': [1,0,0],'diameterM': 3.1,'immersionM': 6.548704624176025,'azimuthPivotModelM': [-136,-4.548704624176025,-7],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'DESIGN_APPROXIMATION'}},
    {'id': 'AMC_OUT_PROP_S','proxyNode': 'PropulsorAnchor_2','lodNode': 'AMC_OUT_PROP_S','positionModelM': [-134.14999389648438,-6.548704624176025,7],'shaftAxisModel': [1,0,0],'diameterM': 3.1,'immersionM': 6.548704624176025,'azimuthPivotModelM': [-136,-4.548704624176025,7],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'DESIGN_APPROXIMATION'}},
  ],
  'hysy-981': [
    {'id': 'Thruster_1_SpinPivot','proxyNode': 'PropulsorAnchor_1','lodNode': 'Thruster_1_SpinPivot','positionModelM': [46.400001525878906,-21.799999237060547,23.799999237060547],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [46.400001525878906,-19,23.799999237060547],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_2_SpinPivot','proxyNode': 'PropulsorAnchor_2','lodNode': 'Thruster_2_SpinPivot','positionModelM': [46.400001525878906,-21.799999237060547,34.79999923706055],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [46.400001525878906,-19,34.79999923706055],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_3_SpinPivot','proxyNode': 'PropulsorAnchor_3','lodNode': 'Thruster_3_SpinPivot','positionModelM': [-46.400001525878906,-21.799999237060547,34.79999923706055],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [-46.400001525878906,-19,34.79999923706055],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_4_SpinPivot','proxyNode': 'PropulsorAnchor_4','lodNode': 'Thruster_4_SpinPivot','positionModelM': [-46.400001525878906,-21.799999237060547,23.799999237060547],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [-46.400001525878906,-19,23.799999237060547],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_5_SpinPivot','proxyNode': 'PropulsorAnchor_5','lodNode': 'Thruster_5_SpinPivot','positionModelM': [-46.400001525878906,-21.799999237060547,-23.799999237060547],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [-46.400001525878906,-19,-23.799999237060547],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_6_SpinPivot','proxyNode': 'PropulsorAnchor_6','lodNode': 'Thruster_6_SpinPivot','positionModelM': [-46.400001525878906,-21.799999237060547,-34.79999923706055],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [-46.400001525878906,-19,-34.79999923706055],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_7_SpinPivot','proxyNode': 'PropulsorAnchor_7','lodNode': 'Thruster_7_SpinPivot','positionModelM': [46.400001525878906,-21.799999237060547,-34.79999923706055],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [46.400001525878906,-19,-34.79999923706055],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
    {'id': 'Thruster_8_SpinPivot','proxyNode': 'PropulsorAnchor_8','lodNode': 'Thruster_8_SpinPivot','positionModelM': [46.400001525878906,-21.799999237060547,-23.799999237060547],'shaftAxisModel': [1,0,0],'diameterM': 3.6,'immersionM': 21.799999237060547,'azimuthPivotModelM': [46.400001525878906,-19,-23.799999237060547],'azimuthAxisModel': [0,1,0],'provenance': {'status': 'XY_DOCUMENTED; Z_AND_DIAMETER_DESIGN_APPROXIMATION'}},
  ],
  'dredger-tianjing': [
    {'id': 'TJ_PROP_PORT','proxyNode': 'PropulsorAnchor_1','lodNode': 'TJ_PROP_PORT','positionModelM': [-53.5,-3.299999952316284,-6.099999904632568],'shaftAxisModel': [1,0,0],'diameterM': 3.4,'immersionM': 3.299999952316284,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
    {'id': 'TJ_PROP_STBD','proxyNode': 'PropulsorAnchor_2','lodNode': 'TJ_PROP_STBD','positionModelM': [-53.5,-3.299999952316284,6.099999904632568],'shaftAxisModel': [1,0,0],'diameterM': 3.4,'immersionM': 3.299999952316284,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
  ],
  'type055-nanchang-101': [
    {'id': 'PROP_PORT','proxyNode': 'PropulsorAnchor_1','lodNode': 'PROP_PORT','positionModelM': [-82.9700927734375,2.7126998901367188,-4.800000190734863],'shaftAxisModel': [-0.9993413026689003,-0.036289954257381185,-1.5094608453782666e-07],'diameterM': 4.6,'immersionM': 4.337300109863281,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
    {'id': 'PROP_STARBOARD','proxyNode': 'PropulsorAnchor_2','lodNode': 'PROP_STARBOARD','positionModelM': [-82.9700927734375,2.7126998901367188,4.800000190734863],'shaftAxisModel': [-0.9993413026689003,-0.036289954257381185,-1.5094608453782666e-07],'diameterM': 4.6,'immersionM': 4.337300109863281,'provenance': {'status': 'DESIGN_APPROXIMATION'}},
  ],
};
