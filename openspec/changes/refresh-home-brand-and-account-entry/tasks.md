## Tasks

- [ ] 1. Generate and register the Deep Blue brand logo.
  - Use image2 to generate the “深蓝智控” calligraphic art logo.
  - Store the asset and metadata under `public/assets/platform-brand/`.

- [ ] 2. Update homepage topbar brand and entry actions.
  - Replace old brand copy and icon treatment.
  - Consume the logo through a shared platform brand lockup/component or helper.
  - Keep center links to the six product modules only.
  - Replace “进入驾驶舱” with shared “个人中心 + theme switch” behavior.

- [ ] 3. Add brand and navigation governance checks.
  - Verify homepage entries derive from central navigation metadata.
  - Verify the brand asset is not stored in a page-local folder.

- [ ] 4. Validate visual behavior.
  - Run `rtk openspec validate refresh-home-brand-and-account-entry --strict`.
  - Capture homepage desktop and mobile screenshots in light and dark themes.
  - Confirm text does not clip or overlap.
