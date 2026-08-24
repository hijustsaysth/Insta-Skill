主要问题
1. 总览文档已过期，需要优先更新
   [Instagram养号skills包设计总览.md (line 242)](/F:/intern_work1/docs/plans/Instagram养号skills包设计总览.md:242) 里仍把 instagram-video-interaction 写成依赖 instagram-core / ctx.instagram，并注册 instagram_video_search / like / comment。这和最新版“connector 直接 MCP，video-interaction 只做决策”的方案冲突。
   同文档还把 instagram-connector 写成“后续保留 / 第一期不实现”的旧定位，和现在已沉淀的 MCP 方案不一致。
2. profile-setup 缺 SKILL.md 设计，且职责偏执行
   [instagram-profile-setup包设计与实现方案.md (line 90)](/F:/intern_work1/docs/plans/instagram-profile-setup包设计与实现方案.md:90) 注册了 instagram_profile_edit，并直接通过 InstagramClient.profile.updateProfile 更新资料。
   如果按最新标准，skill 应生成资料方案和编辑计划，正式资料更新应交给 agent 服务调用 provider/tool 执行。当前方案可行，但不符合“skills 不执行计划”的新标准。
3. content-publish 缺 SKILL.md 设计，且职责偏执行
   [instagram-content-publish包设计与实现方案.md (line 95)](/F:/intern_work1/docs/plans/instagram-content-publish包设计与实现方案.md:95) 注册了发布和状态查询工具，并通过 InstagramClient.publish.publishContent 执行发布。
   如果目标是结构化日志、benchmark、agent eval，建议改成：skill 生成草稿、发布计划、状态查询计划；agent 服务执行发布和查询。
4. instagram-core 与业务文档存在 branded constructor 缺口
   [instagram-core包设计与实现方案.md (line 139)](/F:/intern_work1/docs/plans/instagram-core包设计与实现方案.md:139) 只定义了 branded type。
   但 [profile (line 275)](/F:/intern_work1/docs/plans/instagram-profile-setup包设计与实现方案.md:275) 和 [content (line 223)](/F:/intern_work1/docs/plans/instagram-content-publish包设计与实现方案.md:223) 都写了调用 InstagramAccountId(request.accountId) 这类构造函数。需要在 core 方案里补齐构造函数 API，或改回明确的转换方式。
5. aiograpi-rest 文档有一个小表述冲突
   [instagram-aiograpi-rest包设计与实现方案.md (line 115)](/F:/intern_work1/docs/plans/instagram-aiograpi-rest包设计与实现方案.md:115) 写 index.ts 导出插件入口且不依赖 Cordis，但同表又要求 plugin.ts 独立子路径导出。建议改为：index.ts 只导出 client/config 类型；plugin.ts 单独导出 Cordis 插件入口。
两个必查点
包	SKILL.md 职责是否明确	skills 职责是否符合最新标准
instagram-warmup-orchestrator	通过	通过，只生成计划和汇总
instagram-video-interaction	通过	通过，只做计划、判断、评论生成、日志汇总
instagram-profile-setup	不通过，缺 SKILL.md	不通过，包含资料编辑执行
instagram-content-publish	不通过，缺 SKILL.md	不通过，包含发布和状态查询执行
instagram-core	不适用	不适用，接口包
instagram	不适用	不适用，Cordis 适配包
instagram-aiograpi-rest	不适用	不适用，provider 包
instagram-official-api	不适用	不适用，provider 包
instagram-connector	不强制需要	不适用，MCP Server / 执行层
总览文档	不适用	不通过，仍是旧标准


完整性 / 可行性判断
- warmup-orchestrator：完整性好，可行性高，符合最新标准。
- video-interaction：完整性好，可行性高，已覆盖无视觉模型降级。
- connector：方案合理，可行；依赖真实 Android connector 和 MCP Server 实现，工程风险主要在本地 runtime / 设备稳定性。
- core / instagram / aiograpi-rest / official-api：作为 provider 体系基本完整，但需要补 branded constructor 和少量导出边界。
- profile-setup / content-publish：业务内容完整，但需要按最新 skill 标准重构职责边界。
- 总览：需要统一更新，否则会误导后续开发顺序和包依赖。