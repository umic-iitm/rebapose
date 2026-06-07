NUM_KEYPOINTS = 18
auto_scale_lr = dict(base_batch_size=128)
backend_args = dict(backend='local')
base_lr = 0.005
codec = dict(
    heatmap_size=(
        48,
        64,
    ),
    input_size=(
        192,
        256,
    ),
    sigma=2,
    type='MSRAHeatmap')
custom_hooks = [
    dict(
        ema_type='ExpMomentumEMA',
        momentum=0.0002,
        priority=49,
        type='EMAHook',
        update_buffers=True),
    dict(
        switch_epoch=110,
        switch_pipeline=[
            dict(backend_args=dict(backend='local'), type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(direction='horizontal', type='RandomFlip'),
            dict(type='RandomHalfBody'),
            dict(
                rotate_factor=60,
                scale_factor=[
                    0.75,
                    1.25,
                ],
                shift_factor=0.0,
                type='RandomBBoxTransform'),
            dict(input_size=(
                192,
                256,
            ), type='TopdownAffine'),
            dict(type='mmdet.YOLOXHSVRandomAug'),
            dict(
                transforms=[
                    dict(p=0.1, type='Blur'),
                    dict(p=0.1, type='MedianBlur'),
                    dict(
                        max_height=0.4,
                        max_holes=1,
                        max_width=0.4,
                        min_height=0.2,
                        min_holes=1,
                        min_width=0.2,
                        p=0.5,
                        type='CoarseDropout'),
                ],
                type='Albumentation'),
            dict(
                encoder=dict(
                    heatmap_size=(
                        48,
                        64,
                    ),
                    input_size=(
                        192,
                        256,
                    ),
                    sigma=2,
                    type='MSRAHeatmap'),
                type='GenerateTarget'),
            dict(type='PackPoseInputs'),
        ],
        type='mmdet.PipelineSwitchHook'),
]
data_mode = 'topdown'
data_root = './data/'
dataset_info = dict(
    classes='person',
    dataset_name='Keypoint_reba',
    joint_weights=[
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
    ],
    keypoint_info=dict({
        0:
        dict(color=[
            255,
            0,
            0,
        ], id=0, name='Forehead', swap='', type=''),
        1:
        dict(color=[
            255,
            127,
            0,
        ], id=1, name='Nose', swap='', type=''),
        10:
        dict(
            color=[
                255,
                127,
                0,
            ], id=10, name='Center Hip', swap='', type=''),
        11:
        dict(color=[
            255,
            255,
            0,
        ], id=11, name='Right Hip', swap='', type=''),
        12:
        dict(color=[
            0,
            255,
            0,
        ], id=12, name='Left Knee', swap='', type=''),
        13:
        dict(
            color=[
                0,
                255,
                255,
            ], id=13, name='Right Knee', swap='', type=''),
        14:
        dict(color=[
            0,
            0,
            255,
        ], id=14, name='Left Ankle', swap='', type=''),
        15:
        dict(
            color=[
                139,
                0,
                255,
            ], id=15, name='Right Ankle', swap='', type=''),
        16:
        dict(color=[
            255,
            0,
            255,
        ], id=16, name='Left Hand', swap='', type=''),
        17:
        dict(
            color=[
                160,
                82,
                45,
            ], id=17, name='Right Hand', swap='', type=''),
        2:
        dict(color=[
            255,
            255,
            0,
        ], id=2, name='Neck', swap='', type=''),
        3:
        dict(
            color=[
                0,
                255,
                0,
            ], id=3, name='Left Shoulder', swap='', type=''),
        4:
        dict(
            color=[
                0,
                255,
                255,
            ],
            id=4,
            name='Right Shoulder',
            swap='',
            type=''),
        5:
        dict(color=[
            0,
            0,
            255,
        ], id=5, name='Left Elbow', swap='', type=''),
        6:
        dict(
            color=[
                139,
                0,
                255,
            ], id=6, name='Right Elbow', swap='', type=''),
        7:
        dict(color=[
            255,
            0,
            255,
        ], id=7, name='Left Wrist', swap='', type=''),
        8:
        dict(
            color=[
                160,
                82,
                45,
            ], id=8, name='Right Wrist', swap='', type=''),
        9:
        dict(color=[
            255,
            0,
            0,
        ], id=9, name='Left Hip', swap='', type='')
    }),
    paper_info=dict(author='Reba pose', title='Reba Keypoints Detection'),
    sigmas=[
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
        0.025,
    ],
    skeleton_info=dict({
        0:
        dict(color=[
            255,
            0,
            0,
        ], id=0, link=(
            'Forehead',
            'Nose',
        )),
        1:
        dict(color=[
            255,
            0,
            0,
        ], id=1, link=(
            'Nose',
            'Neck',
        )),
        10:
        dict(color=[
            255,
            0,
            0,
        ], id=10, link=(
            'Center Hip',
            'Right Hip',
        )),
        11:
        dict(color=[
            255,
            0,
            0,
        ], id=11, link=(
            'Left Hip',
            'Left Knee',
        )),
        12:
        dict(color=[
            255,
            0,
            0,
        ], id=12, link=(
            'Right Hip',
            'Right Knee',
        )),
        13:
        dict(color=[
            255,
            0,
            0,
        ], id=13, link=(
            'Left Knee',
            'Left Ankle',
        )),
        14:
        dict(color=[
            255,
            0,
            0,
        ], id=14, link=(
            'Right Knee',
            'Right Ankle',
        )),
        15:
        dict(color=[
            255,
            0,
            0,
        ], id=15, link=(
            'Left Wrist',
            'Left Hand',
        )),
        16:
        dict(color=[
            255,
            0,
            0,
        ], id=16, link=(
            'Right Wrist',
            'Right Hand',
        )),
        2:
        dict(color=[
            255,
            0,
            0,
        ], id=2, link=(
            'Neck',
            'Left Shoulder',
        )),
        3:
        dict(color=[
            255,
            0,
            0,
        ], id=3, link=(
            'Neck',
            'Right Shoulder',
        )),
        4:
        dict(
            color=[
                255,
                0,
                0,
            ], id=4, link=(
                'Left Shoulder',
                'Left Elbow',
            )),
        5:
        dict(
            color=[
                255,
                0,
                0,
            ],
            id=5,
            link=(
                'Right Shoulder',
                'Right Elbow',
            )),
        6:
        dict(color=[
            255,
            0,
            0,
        ], id=6, link=(
            'Left Elbow',
            'Left Wrist',
        )),
        7:
        dict(color=[
            255,
            0,
            0,
        ], id=7, link=(
            'Right Elbow',
            'Right Wrist',
        )),
        8:
        dict(color=[
            255,
            0,
            0,
        ], id=8, link=(
            'Neck',
            'Center Hip',
        )),
        9:
        dict(color=[
            255,
            0,
            0,
        ], id=9, link=(
            'Left Hip',
            'Center Hip',
        ))
    }))
dataset_type = 'CocoDataset'
default_hooks = dict(
    checkpoint=dict(
        _scope_='mmpose',
        interval=10,
        max_keep_ckpts=2,
        rule='greater',
        save_best='PCK',
        type='CheckpointHook'),
    logger=dict(_scope_='mmpose', interval=50, type='LoggerHook'),
    param_scheduler=dict(_scope_='mmpose', type='ParamSchedulerHook'),
    sampler_seed=dict(_scope_='mmpose', type='DistSamplerSeedHook'),
    timer=dict(_scope_='mmpose', type='IterTimerHook'),
    visualization=dict(
        _scope_='mmpose', enable=False, type='PoseVisualizationHook'))
default_scope = 'mmpose'
env_cfg = dict(
    cudnn_benchmark=False,
    dist_cfg=dict(backend='nccl'),
    mp_cfg=dict(mp_start_method='fork', opencv_num_threads=0))
launcher = 'none'
load_from = None
log_level = 'INFO'
log_processor = dict(
    _scope_='mmpose',
    by_epoch=True,
    num_digits=6,
    type='LogProcessor',
    window_size=50)
max_epochs = 120
model = dict(
    backbone=dict(
        extra=dict(
            stage1=dict(
                block='BOTTLENECK',
                num_blocks=(4, ),
                num_branches=1,
                num_channels=(64, ),
                num_modules=1),
            stage2=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                ),
                num_branches=2,
                num_channels=(
                    32,
                    64,
                ),
                num_modules=1),
            stage3=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                    4,
                ),
                num_branches=3,
                num_channels=(
                    32,
                    64,
                    128,
                ),
                num_modules=4),
            stage4=dict(
                block='BASIC',
                num_blocks=(
                    4,
                    4,
                    4,
                    4,
                ),
                num_branches=4,
                num_channels=(
                    32,
                    64,
                    128,
                    256,
                ),
                num_modules=3)),
        in_channels=3,
        init_cfg=dict(
            checkpoint=
            'https://download.openmmlab.com/mmpose/pretrain_models/hrnet_w32-36af842e.pth',
            type='Pretrained'),
        type='HRNet'),
    data_preprocessor=dict(
        bgr_to_rgb=True,
        mean=[
            123.675,
            116.28,
            103.53,
        ],
        std=[
            58.395,
            57.12,
            57.375,
        ],
        type='PoseDataPreprocessor'),
    head=dict(
        decoder=dict(
            heatmap_size=(
                48,
                64,
            ),
            input_size=(
                192,
                256,
            ),
            sigma=2,
            type='MSRAHeatmap'),
        deconv_out_channels=None,
        in_channels=32,
        loss=dict(type='KeypointMSELoss', use_target_weight=True),
        out_channels=18,
        type='HeatmapHead'),
    test_cfg=dict(flip_mode='heatmap', flip_test=True, shift_heatmap=True),
    type='TopdownPoseEstimator')
optim_wrapper = dict(
    optimizer=dict(lr=0.005, type='AdamW', weight_decay=0.05),
    paramwise_cfg=dict(
        bias_decay_mult=0, bypass_duplicate=True, norm_decay_mult=0),
    type='OptimWrapper')
param_scheduler = [
    dict(
        begin=0, by_epoch=False, end=600, start_factor=0.0001,
        type='LinearLR'),
    dict(
        T_max=60,
        begin=60,
        by_epoch=True,
        convert_to_iter_based=True,
        end=120,
        eta_min=0.00025,
        type='CosineAnnealingLR'),
]
randomness = dict(seed=2023)
resume = False
stage2_num_epochs = 10
test_cfg = dict()
test_dataloader = dict(
    batch_size=32,
    dataset=dict(
        ann_file='test.json',
        data_mode='topdown',
        data_prefix=dict(img='images/'),
        data_root='./data/',
        metainfo=dict(
            classes='person',
            dataset_name='Keypoint_reba',
            joint_weights=[
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
            ],
            keypoint_info=dict({
                0:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=0,
                    name='Forehead',
                    swap='',
                    type=''),
                1:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ], id=1, name='Nose', swap='', type=''),
                10:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ],
                    id=10,
                    name='Center Hip',
                    swap='',
                    type=''),
                11:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ],
                    id=11,
                    name='Right Hip',
                    swap='',
                    type=''),
                12:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=12,
                    name='Left Knee',
                    swap='',
                    type=''),
                13:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=13,
                    name='Right Knee',
                    swap='',
                    type=''),
                14:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=14,
                    name='Left Ankle',
                    swap='',
                    type=''),
                15:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=15,
                    name='Right Ankle',
                    swap='',
                    type=''),
                16:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=16,
                    name='Left Hand',
                    swap='',
                    type=''),
                17:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=17,
                    name='Right Hand',
                    swap='',
                    type=''),
                2:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ], id=2, name='Neck', swap='', type=''),
                3:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=3,
                    name='Left Shoulder',
                    swap='',
                    type=''),
                4:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=4,
                    name='Right Shoulder',
                    swap='',
                    type=''),
                5:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=5,
                    name='Left Elbow',
                    swap='',
                    type=''),
                6:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=6,
                    name='Right Elbow',
                    swap='',
                    type=''),
                7:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=7,
                    name='Left Wrist',
                    swap='',
                    type=''),
                8:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=8,
                    name='Right Wrist',
                    swap='',
                    type=''),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    name='Left Hip',
                    swap='',
                    type='')
            }),
            paper_info=dict(
                author='Reba pose', title='Reba Keypoints Detection'),
            sigmas=[
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
            ],
            skeleton_info=dict({
                0:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=0, link=(
                    'Forehead',
                    'Nose',
                )),
                1:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=1, link=(
                    'Nose',
                    'Neck',
                )),
                10:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=10,
                    link=(
                        'Center Hip',
                        'Right Hip',
                    )),
                11:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=11,
                    link=(
                        'Left Hip',
                        'Left Knee',
                    )),
                12:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=12,
                    link=(
                        'Right Hip',
                        'Right Knee',
                    )),
                13:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=13,
                    link=(
                        'Left Knee',
                        'Left Ankle',
                    )),
                14:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=14,
                    link=(
                        'Right Knee',
                        'Right Ankle',
                    )),
                15:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=15,
                    link=(
                        'Left Wrist',
                        'Left Hand',
                    )),
                16:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=16,
                    link=(
                        'Right Wrist',
                        'Right Hand',
                    )),
                2:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=2,
                    link=(
                        'Neck',
                        'Left Shoulder',
                    )),
                3:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=3,
                    link=(
                        'Neck',
                        'Right Shoulder',
                    )),
                4:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=4,
                    link=(
                        'Left Shoulder',
                        'Left Elbow',
                    )),
                5:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=5,
                    link=(
                        'Right Shoulder',
                        'Right Elbow',
                    )),
                6:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=6,
                    link=(
                        'Left Elbow',
                        'Left Wrist',
                    )),
                7:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=7,
                    link=(
                        'Right Elbow',
                        'Right Wrist',
                    )),
                8:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=8, link=(
                    'Neck',
                    'Center Hip',
                )),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    link=(
                        'Left Hip',
                        'Center Hip',
                    ))
            })),
        pipeline=[
            dict(backend_args=dict(backend='local'), type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(input_size=(
                192,
                256,
            ), type='TopdownAffine'),
            dict(type='PackPoseInputs'),
        ],
        type='CocoDataset'),
    drop_last=False,
    num_workers=2,
    persistent_workers=True,
    sampler=dict(round_up=False, shuffle=False, type='DefaultSampler'))
test_evaluator = [
    dict(ann_file='./data/test.json', type='CocoMetric'),
    dict(thr=0.2, type='PCKAccuracy'),
    dict(type='AUC'),
    dict(keypoint_indices=[
        0,
        1,
    ], norm_mode='keypoint_distance', type='NME'),
]
train_batch_size = 128
train_cfg = dict(by_epoch=True, max_epochs=120, val_begin=5, val_interval=5)
train_dataloader = dict(
    batch_size=128,
    dataset=dict(
        ann_file='trainval.json',
        data_mode='topdown',
        data_prefix=dict(img='images/'),
        data_root='./data/',
        metainfo=dict(
            classes='person',
            dataset_name='Keypoint_reba',
            joint_weights=[
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
            ],
            keypoint_info=dict({
                0:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=0,
                    name='Forehead',
                    swap='',
                    type=''),
                1:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ], id=1, name='Nose', swap='', type=''),
                10:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ],
                    id=10,
                    name='Center Hip',
                    swap='',
                    type=''),
                11:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ],
                    id=11,
                    name='Right Hip',
                    swap='',
                    type=''),
                12:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=12,
                    name='Left Knee',
                    swap='',
                    type=''),
                13:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=13,
                    name='Right Knee',
                    swap='',
                    type=''),
                14:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=14,
                    name='Left Ankle',
                    swap='',
                    type=''),
                15:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=15,
                    name='Right Ankle',
                    swap='',
                    type=''),
                16:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=16,
                    name='Left Hand',
                    swap='',
                    type=''),
                17:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=17,
                    name='Right Hand',
                    swap='',
                    type=''),
                2:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ], id=2, name='Neck', swap='', type=''),
                3:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=3,
                    name='Left Shoulder',
                    swap='',
                    type=''),
                4:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=4,
                    name='Right Shoulder',
                    swap='',
                    type=''),
                5:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=5,
                    name='Left Elbow',
                    swap='',
                    type=''),
                6:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=6,
                    name='Right Elbow',
                    swap='',
                    type=''),
                7:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=7,
                    name='Left Wrist',
                    swap='',
                    type=''),
                8:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=8,
                    name='Right Wrist',
                    swap='',
                    type=''),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    name='Left Hip',
                    swap='',
                    type='')
            }),
            paper_info=dict(
                author='Reba pose', title='Reba Keypoints Detection'),
            sigmas=[
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
            ],
            skeleton_info=dict({
                0:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=0, link=(
                    'Forehead',
                    'Nose',
                )),
                1:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=1, link=(
                    'Nose',
                    'Neck',
                )),
                10:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=10,
                    link=(
                        'Center Hip',
                        'Right Hip',
                    )),
                11:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=11,
                    link=(
                        'Left Hip',
                        'Left Knee',
                    )),
                12:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=12,
                    link=(
                        'Right Hip',
                        'Right Knee',
                    )),
                13:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=13,
                    link=(
                        'Left Knee',
                        'Left Ankle',
                    )),
                14:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=14,
                    link=(
                        'Right Knee',
                        'Right Ankle',
                    )),
                15:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=15,
                    link=(
                        'Left Wrist',
                        'Left Hand',
                    )),
                16:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=16,
                    link=(
                        'Right Wrist',
                        'Right Hand',
                    )),
                2:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=2,
                    link=(
                        'Neck',
                        'Left Shoulder',
                    )),
                3:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=3,
                    link=(
                        'Neck',
                        'Right Shoulder',
                    )),
                4:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=4,
                    link=(
                        'Left Shoulder',
                        'Left Elbow',
                    )),
                5:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=5,
                    link=(
                        'Right Shoulder',
                        'Right Elbow',
                    )),
                6:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=6,
                    link=(
                        'Left Elbow',
                        'Left Wrist',
                    )),
                7:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=7,
                    link=(
                        'Right Elbow',
                        'Right Wrist',
                    )),
                8:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=8, link=(
                    'Neck',
                    'Center Hip',
                )),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    link=(
                        'Left Hip',
                        'Center Hip',
                    ))
            })),
        pipeline=[
            dict(backend_args=dict(backend='local'), type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(direction='horizontal', type='RandomFlip'),
            dict(
                rotate_factor=30,
                scale_factor=[
                    0.8,
                    1.2,
                ],
                type='RandomBBoxTransform'),
            dict(input_size=(
                192,
                256,
            ), type='TopdownAffine'),
            dict(type='mmdet.YOLOXHSVRandomAug'),
            dict(
                transforms=[
                    dict(p=0.5, type='ChannelShuffle'),
                    dict(p=0.5, type='CLAHE'),
                    dict(p=0.5, type='ColorJitter'),
                    dict(
                        max_height=0.3,
                        max_holes=4,
                        max_width=0.3,
                        min_height=0.2,
                        min_holes=1,
                        min_width=0.2,
                        p=0.5,
                        type='CoarseDropout'),
                ],
                type='Albumentation'),
            dict(
                encoder=dict(
                    heatmap_size=(
                        48,
                        64,
                    ),
                    input_size=(
                        192,
                        256,
                    ),
                    sigma=2,
                    type='MSRAHeatmap'),
                type='GenerateTarget'),
            dict(type='PackPoseInputs'),
        ],
        type='CocoDataset'),
    num_workers=2,
    persistent_workers=True,
    sampler=dict(shuffle=True, type='DefaultSampler'))
train_pipeline = [
    dict(backend_args=dict(backend='local'), type='LoadImage'),
    dict(type='GetBBoxCenterScale'),
    dict(direction='horizontal', type='RandomFlip'),
    dict(
        rotate_factor=30,
        scale_factor=[
            0.8,
            1.2,
        ],
        type='RandomBBoxTransform'),
    dict(input_size=(
        192,
        256,
    ), type='TopdownAffine'),
    dict(type='mmdet.YOLOXHSVRandomAug'),
    dict(
        transforms=[
            dict(p=0.5, type='ChannelShuffle'),
            dict(p=0.5, type='CLAHE'),
            dict(p=0.5, type='ColorJitter'),
            dict(
                max_height=0.3,
                max_holes=4,
                max_width=0.3,
                min_height=0.2,
                min_holes=1,
                min_width=0.2,
                p=0.5,
                type='CoarseDropout'),
        ],
        type='Albumentation'),
    dict(
        encoder=dict(
            heatmap_size=(
                48,
                64,
            ),
            input_size=(
                192,
                256,
            ),
            sigma=2,
            type='MSRAHeatmap'),
        type='GenerateTarget'),
    dict(type='PackPoseInputs'),
]
train_pipeline_stage2 = [
    dict(backend_args=dict(backend='local'), type='LoadImage'),
    dict(type='GetBBoxCenterScale'),
    dict(direction='horizontal', type='RandomFlip'),
    dict(type='RandomHalfBody'),
    dict(
        rotate_factor=60,
        scale_factor=[
            0.75,
            1.25,
        ],
        shift_factor=0.0,
        type='RandomBBoxTransform'),
    dict(input_size=(
        192,
        256,
    ), type='TopdownAffine'),
    dict(type='mmdet.YOLOXHSVRandomAug'),
    dict(
        transforms=[
            dict(p=0.1, type='Blur'),
            dict(p=0.1, type='MedianBlur'),
            dict(
                max_height=0.4,
                max_holes=1,
                max_width=0.4,
                min_height=0.2,
                min_holes=1,
                min_width=0.2,
                p=0.5,
                type='CoarseDropout'),
        ],
        type='Albumentation'),
    dict(
        encoder=dict(
            heatmap_size=(
                48,
                64,
            ),
            input_size=(
                192,
                256,
            ),
            sigma=2,
            type='MSRAHeatmap'),
        type='GenerateTarget'),
    dict(type='PackPoseInputs'),
]
val_batch_size = 32
val_cfg = dict()
val_dataloader = dict(
    batch_size=32,
    dataset=dict(
        ann_file='test.json',
        data_mode='topdown',
        data_prefix=dict(img='images/'),
        data_root='./data/',
        metainfo=dict(
            classes='person',
            dataset_name='Keypoint_reba',
            joint_weights=[
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
                1.0,
            ],
            keypoint_info=dict({
                0:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=0,
                    name='Forehead',
                    swap='',
                    type=''),
                1:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ], id=1, name='Nose', swap='', type=''),
                10:
                dict(
                    color=[
                        255,
                        127,
                        0,
                    ],
                    id=10,
                    name='Center Hip',
                    swap='',
                    type=''),
                11:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ],
                    id=11,
                    name='Right Hip',
                    swap='',
                    type=''),
                12:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=12,
                    name='Left Knee',
                    swap='',
                    type=''),
                13:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=13,
                    name='Right Knee',
                    swap='',
                    type=''),
                14:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=14,
                    name='Left Ankle',
                    swap='',
                    type=''),
                15:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=15,
                    name='Right Ankle',
                    swap='',
                    type=''),
                16:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=16,
                    name='Left Hand',
                    swap='',
                    type=''),
                17:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=17,
                    name='Right Hand',
                    swap='',
                    type=''),
                2:
                dict(
                    color=[
                        255,
                        255,
                        0,
                    ], id=2, name='Neck', swap='', type=''),
                3:
                dict(
                    color=[
                        0,
                        255,
                        0,
                    ],
                    id=3,
                    name='Left Shoulder',
                    swap='',
                    type=''),
                4:
                dict(
                    color=[
                        0,
                        255,
                        255,
                    ],
                    id=4,
                    name='Right Shoulder',
                    swap='',
                    type=''),
                5:
                dict(
                    color=[
                        0,
                        0,
                        255,
                    ],
                    id=5,
                    name='Left Elbow',
                    swap='',
                    type=''),
                6:
                dict(
                    color=[
                        139,
                        0,
                        255,
                    ],
                    id=6,
                    name='Right Elbow',
                    swap='',
                    type=''),
                7:
                dict(
                    color=[
                        255,
                        0,
                        255,
                    ],
                    id=7,
                    name='Left Wrist',
                    swap='',
                    type=''),
                8:
                dict(
                    color=[
                        160,
                        82,
                        45,
                    ],
                    id=8,
                    name='Right Wrist',
                    swap='',
                    type=''),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    name='Left Hip',
                    swap='',
                    type='')
            }),
            paper_info=dict(
                author='Reba pose', title='Reba Keypoints Detection'),
            sigmas=[
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
                0.025,
            ],
            skeleton_info=dict({
                0:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=0, link=(
                    'Forehead',
                    'Nose',
                )),
                1:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=1, link=(
                    'Nose',
                    'Neck',
                )),
                10:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=10,
                    link=(
                        'Center Hip',
                        'Right Hip',
                    )),
                11:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=11,
                    link=(
                        'Left Hip',
                        'Left Knee',
                    )),
                12:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=12,
                    link=(
                        'Right Hip',
                        'Right Knee',
                    )),
                13:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=13,
                    link=(
                        'Left Knee',
                        'Left Ankle',
                    )),
                14:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=14,
                    link=(
                        'Right Knee',
                        'Right Ankle',
                    )),
                15:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=15,
                    link=(
                        'Left Wrist',
                        'Left Hand',
                    )),
                16:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=16,
                    link=(
                        'Right Wrist',
                        'Right Hand',
                    )),
                2:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=2,
                    link=(
                        'Neck',
                        'Left Shoulder',
                    )),
                3:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=3,
                    link=(
                        'Neck',
                        'Right Shoulder',
                    )),
                4:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=4,
                    link=(
                        'Left Shoulder',
                        'Left Elbow',
                    )),
                5:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=5,
                    link=(
                        'Right Shoulder',
                        'Right Elbow',
                    )),
                6:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=6,
                    link=(
                        'Left Elbow',
                        'Left Wrist',
                    )),
                7:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=7,
                    link=(
                        'Right Elbow',
                        'Right Wrist',
                    )),
                8:
                dict(color=[
                    255,
                    0,
                    0,
                ], id=8, link=(
                    'Neck',
                    'Center Hip',
                )),
                9:
                dict(
                    color=[
                        255,
                        0,
                        0,
                    ],
                    id=9,
                    link=(
                        'Left Hip',
                        'Center Hip',
                    ))
            })),
        pipeline=[
            dict(backend_args=dict(backend='local'), type='LoadImage'),
            dict(type='GetBBoxCenterScale'),
            dict(input_size=(
                192,
                256,
            ), type='TopdownAffine'),
            dict(type='PackPoseInputs'),
        ],
        type='CocoDataset'),
    drop_last=False,
    num_workers=2,
    persistent_workers=True,
    sampler=dict(round_up=False, shuffle=False, type='DefaultSampler'))
val_evaluator = [
    dict(ann_file='./data/test.json', type='CocoMetric'),
    dict(thr=0.2, type='PCKAccuracy'),
    dict(type='AUC'),
    dict(keypoint_indices=[
        0,
        1,
    ], norm_mode='keypoint_distance', type='NME'),
]
val_interval = 5
val_pipeline = [
    dict(backend_args=dict(backend='local'), type='LoadImage'),
    dict(type='GetBBoxCenterScale'),
    dict(input_size=(
        192,
        256,
    ), type='TopdownAffine'),
    dict(type='PackPoseInputs'),
]
vis_backends = [
    dict(_scope_='mmpose', type='LocalVisBackend'),
]
visualizer = dict(
    _scope_='mmpose',
    name='visualizer',
    type='PoseLocalVisualizer',
    vis_backends=[
        dict(type='LocalVisBackend'),
    ])
work_dir = './work_dir'
