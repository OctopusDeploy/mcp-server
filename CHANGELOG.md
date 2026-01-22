# Changelog

## [1.1.0](https://github.com/OctopusDeploy/mcp-server/compare/v1.0.1...v1.1.0) (2026-01-22)


### Features

* Add create release / deploy release tools ([#61](https://github.com/OctopusDeploy/mcp-server/issues/61)) ([6caa0f8](https://github.com/OctopusDeploy/mcp-server/commit/6caa0f8c168e4a4fa26014c35e679239917e34e7))
* Combine some get/list tools into find tools for better tool discovery ([#60](https://github.com/OctopusDeploy/mcp-server/issues/60)) ([4f7c3a5](https://github.com/OctopusDeploy/mcp-server/commit/4f7c3a5d3408573cbf61c31fc33c3b1c0d5e8f18))
* Improved error handling to guide models better ([#20](https://github.com/OctopusDeploy/mcp-server/issues/20)) ([7b7883d](https://github.com/OctopusDeploy/mcp-server/commit/7b7883d8c2a51da53d0b27faa0ccdf735f35ad9f))


### Performance Improvements

* optimize space resolver to use direct get() instead of list() ([#57](https://github.com/OctopusDeploy/mcp-server/issues/57)) ([bb6dd15](https://github.com/OctopusDeploy/mcp-server/commit/bb6dd15f1adbb955c722852f34838039264086e2))

## [1.0.1](https://github.com/OctopusDeploy/mcp-server/compare/v1.0.0...v1.0.1) (2025-12-12)


### Bug Fixes

* Simplifies list tenants tool ([#53](https://github.com/OctopusDeploy/mcp-server/issues/53)) ([c86d602](https://github.com/OctopusDeploy/mcp-server/commit/c86d602c3b04c56be713974ccec98addeb2aa7c7))

## [1.0.0](https://github.com/OctopusDeploy/mcp-server/compare/v0.3.1...v1.0.0) (2025-11-25)


### ⚠ BREAKING CHANGES

* removes early access labeling

### Bug Fixes

* removes early access labeling ([f63ccf4](https://github.com/OctopusDeploy/mcp-server/commit/f63ccf45a64eccf918deebf41b730e7eccff2190))

## [0.3.1](https://github.com/OctopusDeploy/mcp-server/compare/v0.3.0...v0.3.1) (2025-10-02)


### Bug Fixes

* Add missing pagination parameters to various tools ([#45](https://github.com/OctopusDeploy/mcp-server/issues/45)) ([3d2d444](https://github.com/OctopusDeploy/mcp-server/commit/3d2d444d9e48126937d411a2bb6f1539118c3cd6))

## [0.3.0](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.5...v0.3.0) (2025-10-01)


### Features

* Project variables tool ([#41](https://github.com/OctopusDeploy/mcp-server/issues/41)) ([4c7d1f2](https://github.com/OctopusDeploy/mcp-server/commit/4c7d1f2d46396a20bad6a9742643fd91a3e0e525))


### Bug Fixes

* Change log file path to match entry point instead of node folder ([#44](https://github.com/OctopusDeploy/mcp-server/issues/44)) ([206b6ca](https://github.com/OctopusDeploy/mcp-server/commit/206b6ca8606ab0b58161bbb987b8194bf14dce66))
* Fix SBOM build ([#42](https://github.com/OctopusDeploy/mcp-server/issues/42)) ([9500aa4](https://github.com/OctopusDeploy/mcp-server/commit/9500aa45f66e8e2581a6315c58706e36cba69415))

## [0.2.5](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.4...v0.2.5) (2025-09-25)


### Bug Fixes

* Empty commit to bump version ([#38](https://github.com/OctopusDeploy/mcp-server/issues/38)) ([c2ed767](https://github.com/OctopusDeploy/mcp-server/commit/c2ed7676ca20279aa9c4b393f6cea61f2221020e))

## [0.2.4](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.3...v0.2.4) (2025-09-25)


### Bug Fixes

* Temporarily remove sbom steps ([#36](https://github.com/OctopusDeploy/mcp-server/issues/36)) ([656ae08](https://github.com/OctopusDeploy/mcp-server/commit/656ae08a33793e84ff2a8f1c3f2ffd41494adb60))

## [0.2.3](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.2...v0.2.3) (2025-09-25)


### Bug Fixes

* Add Docker container support ([#32](https://github.com/OctopusDeploy/mcp-server/issues/32)) ([c395f2d](https://github.com/OctopusDeploy/mcp-server/commit/c395f2d5469bd69d747a6bbab170b7c26e8ef6ee))

## [0.2.2](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.1...v0.2.2) (2025-09-19)


### Bug Fixes

* Fix image source URLs in README.md ([#28](https://github.com/OctopusDeploy/mcp-server/issues/28)) ([da6cc4e](https://github.com/OctopusDeploy/mcp-server/commit/da6cc4e757d2a32c015a0f5978703395aac7ceb8))

## [0.2.1](https://github.com/OctopusDeploy/mcp-server/compare/v0.2.0...v0.2.1) (2025-09-19)


### Bug Fixes

* Bump patch to release production version ([#26](https://github.com/OctopusDeploy/mcp-server/issues/26)) ([5bdbd9b](https://github.com/OctopusDeploy/mcp-server/commit/5bdbd9b7bbfe42467d5b1de039fb53fe68abe7ce))

## [0.2.0](https://github.com/OctopusDeploy/mcp-server/compare/v0.1.2...v0.2.0) (2025-09-19)


### Features

* Add account get/list tools ([#13](https://github.com/OctopusDeploy/mcp-server/issues/13)) ([237cff9](https://github.com/OctopusDeploy/mcp-server/commit/237cff94c676b8336a18b6b205f139046f2e3693))
* Add get/list certificates tools ([#9](https://github.com/OctopusDeploy/mcp-server/issues/9)) ([5119956](https://github.com/OctopusDeploy/mcp-server/commit/511995667378df220d0537a3c1ca5aa1a6bc18fe))

## [0.1.2](https://github.com/OctopusDeploy/mcp-server/compare/v0.1.1...v0.1.2) (2025-09-17)
