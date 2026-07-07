## Why

The homepage still presents the old “AI-OBE船舶智控平台 / Mission Control for Maritime Education” identity and a right-side “进入驾驶舱” action. The requested product direction is “深蓝智控” plus the Chinese platform description, with homepage center links limited to the six product modules and the right side using the same personal-center plus theme-switching pattern as module pages.

## What Changes

- Replace the homepage brand lockup with “深蓝智控” calligraphic art logo and “基于学科垂类大模型的船舶智控教学平台”.
- Require the logo asset to be generated with the image2 model and stored under `public/assets/platform-brand/` with route usage metadata.
- Require homepage rendering to consume the governed asset through a shared brand lockup or platform-brand component rather than page-local file usage.
- Keep homepage center navigation to Knowledge Resources, Interactive Learning, Learning Path, Arena, Virtual Simulation, and Control Workbench.
- Replace homepage “进入驾驶舱” with “个人中心 + theme switch”, using the shared top-right account/action language.
- Add visual QA evidence for desktop, mobile, light, and dark theme states.

## Impact

- Updates homepage brand and account entry semantics.
- Extends brand asset governance for the new “深蓝智控” lockup.
- Depends on the canonical navigation order change for destination ordering.
- Does not merge learner dashboard/profile content.
