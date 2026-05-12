# Changelog

## [2.2.0](https://github.com/OctopusDeploy/mcp-server/compare/v2.1.2...v2.2.0) (2026-05-12)


### Features

* improve tool response ergonomics ([#90](https://github.com/OctopusDeploy/mcp-server/issues/90)) ([b1d7bc6](https://github.com/OctopusDeploy/mcp-server/commit/b1d7bc67ec478a2ebe302162b0ebeb1496c4d295))

## [2.1.2](https://github.com/OctopusDeploy/mcp-server/compare/v2.1.1...v2.1.2) (2026-05-12)


### Bug Fixes

* bypass execute path allowlist when all toolsets are enabled ([#88](https://github.com/OctopusDeploy/mcp-server/issues/88)) ([9706576](https://github.com/OctopusDeploy/mcp-server/commit/9706576596c3a4211fdee58bf82f6dc32a1e5714))

## [2.1.1](https://github.com/OctopusDeploy/mcp-server/compare/v2.1.0...v2.1.1) (2026-05-12)


### Bug Fixes

* make execute tool honestly report readOnly:false in capabilities ([#86](https://github.com/OctopusDeploy/mcp-server/issues/86)) ([7222172](https://github.com/OctopusDeploy/mcp-server/commit/722217253ba585746900f35189c0b08cdfe918d7))

## [2.1.0](https://github.com/OctopusDeploy/mcp-server/compare/v2.0.0...v2.1.0) (2026-05-12)


### Features

* invert read-only flag — writes enabled by default, --read-only opts out ([#83](https://github.com/OctopusDeploy/mcp-server/issues/83)) ([b73bf39](https://github.com/OctopusDeploy/mcp-server/commit/b73bf3941f2ee7855506a75ea50461503a833428))

## [2.0.0](https://github.com/OctopusDeploy/mcp-server/compare/v1.1.0...v2.0.0) (2026-05-08)


### ⚠ BREAKING CHANGES

* Replace get_task_* tools with task resources + grep_task_log ([#74](https://github.com/OctopusDeploy/mcp-server/issues/74))
* Add release resources with read_resource tool backstop ([#73](https://github.com/OctopusDeploy/mcp-server/issues/73))

### Features

* Add find_feature_toggles and update_feature_toggle tools ([#81](https://github.com/OctopusDeploy/mcp-server/issues/81)) ([0a435ca](https://github.com/OctopusDeploy/mcp-server/commit/0a435ca49955f05f3025f05dd24e405f1ab9bd17))
* Add find_interruptions tool and interruption resource ([#76](https://github.com/OctopusDeploy/mcp-server/issues/76)) ([5051105](https://github.com/OctopusDeploy/mcp-server/commit/505110576b83da6077d7ae71d2b828cc0b26b087))
* Add llms.txt catalog and execute backstop with hard read/write/delete gating ([#80](https://github.com/OctopusDeploy/mcp-server/issues/80)) ([868e4cf](https://github.com/OctopusDeploy/mcp-server/commit/868e4cfd54a380d6e44c7750a39ef1ced389953e))
* Add release resources with read_resource tool backstop ([#73](https://github.com/OctopusDeploy/mcp-server/issues/73)) ([eb7dcef](https://github.com/OctopusDeploy/mcp-server/commit/eb7dcefd0d34a1280355be5796739e6ab6b5a93b))
* Add requireConfirmation elicitation helper for write gating ([#75](https://github.com/OctopusDeploy/mcp-server/issues/75)) ([daf3701](https://github.com/OctopusDeploy/mcp-server/commit/daf3701191bf707092302e41a1fbb432e4e9c88a))
* Add run_runbook tool, find_runbooks, and runbook resource ([#79](https://github.com/OctopusDeploy/mcp-server/issues/79)) ([ba330d8](https://github.com/OctopusDeploy/mcp-server/commit/ba330d84e7044fc39f6da25161a4c6ea52c308c1))
* Add support for Bearer token (access token) authentication ([#68](https://github.com/OctopusDeploy/mcp-server/issues/68)) ([e21a3be](https://github.com/OctopusDeploy/mcp-server/commit/e21a3be36321679233bf069604d165707a568cec))
* Replace get_task_* tools with task resources + grep_task_log ([#74](https://github.com/OctopusDeploy/mcp-server/issues/74)) ([a45380d](https://github.com/OctopusDeploy/mcp-server/commit/a45380d7daf8fe7c8376dfe952e4044b291bf71e))


### Bug Fixes

* Add version control reference to release and deployment data ([#71](https://github.com/OctopusDeploy/mcp-server/issues/71)) ([09e0b2c](https://github.com/OctopusDeploy/mcp-server/commit/09e0b2c5ceb1ec10374ff243bcfc984423236d52))

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
