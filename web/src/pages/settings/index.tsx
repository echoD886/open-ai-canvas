import { App, Button, InputNumber } from "antd";
import { SettingsRow } from "@/components/ui/product/settings-row";
import { ArrowLeft, Boxes, Brain, Bug, Cloud, MessageSquareText, RadioTower, SlidersHorizontal, UserRound, Workflow } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { UserOSSSettingsForm } from "@/components/layout/user-oss-settings-form";
import { refreshSystemChannels } from "@/lib/user-session";
import { defaultConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { ChannelSettingsPane, channelValidationError, focusInvalidChannelField, isChannelReady } from "./channel-settings-pane";
import { ModelDefaultGrid } from "./model-default-grid";
import { PromptPreferencesPane } from "./prompt-preferences-pane";
import DiagnosticsPanel from "./diagnostics-panel";
import AgentMemoryPane from "./agent-memory-pane";
import { RunningHubSettingsPane } from "./runninghub-settings-pane";
import { RUNNINGHUB_PLUGIN_ID } from "@/lib/plugins/builtin/workflows";
import { usePluginStore } from "@/stores/use-plugin-store";
import { ProfilePane } from "./profile-pane";
import "./settings.css";

type ConfigSectionKey = "profile" | "channels" | "models" | "runninghub" | "preferences" | "prompts" | "agent-memory" | "storage" | "diagnostics";

const configSections: Array<{ key: ConfigSectionKey; label: string; description: string; icon: ReactNode }> = [
    { key: "profile", label: "个人信息", description: "头像、密码与邮箱", icon: <UserRound className="size-4" /> },
    { key: "channels", label: "个人渠道", description: "模型服务与个人工作流", icon: <RadioTower className="size-4" /> },
    { key: "runninghub", label: "RunningHub 工作流", description: "个人渠道的云端工作流配置", icon: <Workflow className="size-4" /> },
    { key: "models", label: "模型选择", description: "按领域选择默认模型", icon: <Boxes className="size-4" /> },
    { key: "preferences", label: "生成偏好", description: "画布生成默认值", icon: <SlidersHorizontal className="size-4" /> },
    { key: "prompts", label: "提示词偏好", description: "按任务定制平台模板", icon: <MessageSquareText className="size-4" /> },
    { key: "agent-memory", label: "Agent 记忆", description: "批准、添加、导出导入、压缩", icon: <Brain className="size-4" /> },
    { key: "storage", label: "我的对象存储", description: "管理个人媒体存储", icon: <Cloud className="size-4" /> },
    { key: "diagnostics", label: "问题诊断", description: "导出日志协助排查", icon: <Bug className="size-4" /> },
];

export function isConfigSection(value: string | null): value is ConfigSectionKey {
    return configSections.some((section) => section.key === value);
}

export default function SettingsPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedSection = searchParams.get("section");
    const customChannelsEnabled = useUserStore((state) => state.features.customChannelsEnabled);
    const runtimeStatuses = usePluginStore((state) => state.runtimeStatuses);
    const runningHubPluginEnabled = runtimeStatuses[RUNNINGHUB_PLUGIN_ID] === "enabled";
    const requestedSectionEnabled = requestedSection !== "runninghub" || runningHubPluginEnabled;
    const initialSection = isConfigSection(requestedSection) && requestedSectionEnabled ? requestedSection : "profile";
    const [activeTab, setActiveTab] = useState<ConfigSectionKey>(initialSection === "channels" && !customChannelsEnabled ? "models" : initialSection);
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const shouldPromptContinue = searchParams.get("continue") === "1";
    const userId = useUserStore((state) => state.user?.id);
    const userChannels = config.channels.filter((channel) => channel.scope !== "system");
    const visibleConfigSections = useMemo(
        () => (customChannelsEnabled ? configSections : configSections.filter((section) => section.key !== "channels")).filter((section) => section.key !== "runninghub" || runningHubPluginEnabled),
        [customChannelsEnabled, runningHubPluginEnabled],
    );

    const isVisibleConfigSection = (value: string | null): value is ConfigSectionKey => isConfigSection(value) && visibleConfigSections.some((section) => section.key === value);

    useEffect(() => {
        if (isVisibleConfigSection(requestedSection)) {
            setActiveTab(requestedSection);
            return;
        }
        setActiveTab(requestedSection === "channels" && !customChannelsEnabled ? "models" : "profile");
    }, [customChannelsEnabled, requestedSection, visibleConfigSections]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        void refreshSystemChannels().catch((error) => {
            if (!cancelled) message.warning(error instanceof Error ? `系统模型刷新失败：${error.message}` : "系统模型刷新失败，继续使用本地缓存");
        });
        return () => {
            cancelled = true;
        };
    }, [message, userId]);

    const selectSection = (section: ConfigSectionKey) => {
        if (section === "runninghub" && !runningHubPluginEnabled) return;
        setActiveTab(section);
        const next = new URLSearchParams(searchParams);
        next.set("section", section);
        setSearchParams(next, { replace: true });
    };

    const finishConfig = () => {
        const invalidChannel = customChannelsEnabled ? userChannels.find((channel) => channelValidationError(channel)) : undefined;
        if (invalidChannel) {
            selectSection("channels");
            message.warning(`${invalidChannel.name || "未命名渠道"}：${channelValidationError(invalidChannel)}`);
            focusInvalidChannelField(invalidChannel);
            return;
        }
        const workflowReady = Boolean(runningHubPluginEnabled && config.runningHub.enabled && config.runningHub.workflowId.trim() && config.runningHub.baseUrl.trim() && config.runningHub.apiKey.trim());
        if (!effectiveConfig.channels.some(isChannelReady) && !workflowReady) {
            selectSection(customChannelsEnabled ? "channels" : "models");
            message.error(customChannelsEnabled ? (shouldPromptContinue ? "请先完成至少一个渠道的 Base URL、API Key 和模型配置" : "当前没有可用渠道，请先完成连接信息和模型配置") : "当前没有可用的系统模型，请联系管理员配置系统渠道");
            return;
        }
        message.success("配置已保存，正在返回创作页面");
        navigate(-1);
    };

    const panes: Record<ConfigSectionKey, ReactNode> = {
        profile: (
            <SettingsPane>
                <ProfilePane key={userId} />
            </SettingsPane>
        ),
        channels: (
            <SettingsPane>
                <ChannelSettingsPane onOpenModels={() => selectSection("models")} onOpenRunningHub={runningHubPluginEnabled ? () => selectSection("runninghub") : undefined} />
            </SettingsPane>
        ),
        models: (
            <SettingsPane>
                <div className="settings-pane-header">
                    <div className="min-w-0">
                        <h2>模型选择</h2>
                        <p>按领域选择默认模型；模型能力与请求协议在渠道“模型与能力”中配置。</p>
                    </div>
                </div>
                <div className="settings-section">
                    <ModelDefaultGrid config={effectiveConfig} onChange={(key, model) => updateConfig(key, model)} />
                </div>
            </SettingsPane>
        ),
        runninghub: (
            <SettingsPane>
                <RunningHubSettingsPane />
            </SettingsPane>
        ),
        preferences: (
            <SettingsPane>
                <div className="settings-pane-header">
                    <div className="min-w-0">
                        <h2>生成偏好</h2>
                        <p>设置新建生成任务时使用的初始值，节点内仍可单独覆盖。</p>
                    </div>
                </div>
                <div className="settings-section">
                    <section className="settings-preference-block">
                        <div className="settings-preference-heading">
                            <h3>画布生成</h3>
                            <p>用于新建图片生成任务，节点内仍可单独覆盖。</p>
                        </div>
                        <SettingsRow
                            label="默认生图张数"
                            control={
                                <InputNumber
                                    min={1}
                                    max={15}
                                    precision={0}
                                    className="w-full"
                                    value={Number(config.canvasImageCount)}
                                    onChange={(value) => updateConfig("canvasImageCount", normalizeImageCount(String(value ?? defaultConfig.canvasImageCount)))}
                                />
                            }
                            controlClassName="w-[200px]"
                        />
                    </section>
                </div>
            </SettingsPane>
        ),
        prompts: (
            <SettingsPane fill>
                <PromptPreferencesPane />
            </SettingsPane>
        ),
        "agent-memory": (
            <SettingsPane>
                <div className="settings-pane-header">
                    <div className="min-w-0">
                        <h2>Agent 记忆</h2>
                        <p>只属于你。Agent 记下的先待批准；手动添加立刻生效。可导入导出，也可用文本模型压缩相近条目。</p>
                    </div>
                </div>
                <div className="settings-section">
                    <AgentMemoryPane />
                </div>
            </SettingsPane>
        ),
        diagnostics: (
            <SettingsPane>
                <DiagnosticsPanel taskId={searchParams.get("taskId") || undefined} projectId={searchParams.get("projectId") || undefined} />
            </SettingsPane>
        ),
        storage: (
            <SettingsPane>
                <div className="settings-section">
                    <UserOSSSettingsForm />
                </div>
            </SettingsPane>
        ),
    };

    return (
        <main className="settings-page app-workspace-page app-user-workspace flex h-full min-h-0 flex-col text-foreground">
            <div className="settings-workspace-shell">
                <header className="settings-workspace-heading">
                    <h1>个人设置</h1>
                    {shouldPromptContinue ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
                                返回创作
                            </Button>
                            <Button type="primary" onClick={finishConfig}>
                                保存并返回
                            </Button>
                        </div>
                    ) : null}
                </header>
                <div className="settings-workspace-layout">
                    <aside className="settings-workspace-sidebar">
                        <nav className="settings-workspace-nav thin-scrollbar" aria-label="配置分类">
                            {visibleConfigSections.map((item) => {
                                const selected = item.key === activeTab;
                                return (
                                    <button key={item.key} type="button" className="settings-workspace-nav-item" onClick={() => selectSection(item.key)} aria-current={selected ? "page" : undefined}>
                                        <span className="shrink-0" aria-hidden="true">
                                            {item.icon}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block whitespace-nowrap text-sm font-medium">{item.label}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>
                    <section className="settings-workspace-content" aria-label={visibleConfigSections.find((section) => section.key === activeTab)?.label}>
                        <div className="settings-workspace-scroll app-workspace-scroll">
                            <div className={`settings-pane-root ${activeTab === "prompts" ? "h-full w-full" : "mx-auto w-full max-w-none"}`}>{panes[activeTab]}</div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function SettingsPane({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
    return <div className={fill ? "settings-pane h-full" : "settings-pane"}>{children}</div>;
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || Number(defaultConfig.canvasImageCount)))));
}
