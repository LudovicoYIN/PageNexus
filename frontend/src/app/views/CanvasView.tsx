import type { Agent } from "@mariozechner/pi-agent-core";
import { Button, Dropdown, Empty, Layout, List, Tag, Tooltip } from "antd";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import type { DocumentRecord, KnowledgeBase } from "../../lib/types";
import { ChatContainer } from "../../components/chat";
import { DocumentPreviewPanel } from "../../components/DocumentPreviewPanel";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  MessageSquare,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

const { Content, Sider } = Layout;

type WorkspaceSession = {
  id: string;
  kbId: string;
  title: string;
};

interface Props {
  activeKb: KnowledgeBase | null;
  activeKbId: string | null;
  canvasSessions: WorkspaceSession[];
  activeSessionId: string | null;
  isUploading: boolean;
  activeDocuments: DocumentRecord[];
  activePreviewDocId: string | null;
  activePreviewDocName: string;
  activePreviewMarkdown: string;
  activePreviewSourcePath?: string;
  previewLoading: boolean;
  previewError: string | null;
  activeAgent: Agent | null;
  isBootingAgent: boolean;
  onBackDashboard: () => void;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onUpload: () => void;
  onOpenDocumentPreview: (docId: string) => void;
  onRetryDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
}

function statusTone(document: DocumentRecord) {
  switch (document.status) {
    case "parsed":
      return "text-emerald-600 bg-emerald-500/10";
    case "failed":
      return "text-rose-600 bg-rose-500/10";
    case "parsing":
      return "text-amber-700 bg-amber-500/10";
    default:
      return "text-slate-500 bg-slate-500/10";
  }
}

function GlowCard(props: PropsWithChildren<{ className?: string }>) {
  return <div className={`glass-panel rounded-[2rem] ${props.className ?? ""}`}>{props.children}</div>;
}

export function CanvasView(props: Props) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <Layout className="min-h-0 flex-1 gap-4 !bg-transparent">
      <Sider
        theme="light"
        trigger={null}
        collapsible
        collapsed={leftCollapsed}
        width={336}
        collapsedWidth={66}
        style={{ background: "transparent" }}
        className="glass-panel h-full rounded-[2.2rem]"
      >
        {leftCollapsed ? (
          <div className="flex h-full flex-col items-center gap-2 px-2 py-3">
            <Tooltip title="返回工作台" placement="right">
              <Button type="text" icon={<ArrowLeft className="h-4 w-4" />} onClick={props.onBackDashboard} />
            </Tooltip>
            <Tooltip title="展开侧边栏" placement="right">
              <Button type="text" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setLeftCollapsed(false)} />
            </Tooltip>
            <div className="my-1 h-px w-7 bg-slate-200" />
            <Tooltip title="创建会话" placement="right">
              <Button type="text" icon={<Plus className="h-4 w-4" />} onClick={props.onCreateSession} />
            </Tooltip>
            <Tooltip title="上传文档" placement="right">
              <Button
                type="text"
                icon={props.isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                onClick={props.onUpload}
                disabled={props.isUploading || !props.activeKbId}
              />
            </Tooltip>
          </div>
        ) : (
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={props.onBackDashboard}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
              <Tooltip title="收起侧边栏">
                <Button type="text" size="small" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setLeftCollapsed(true)} />
              </Tooltip>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <section className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/56 px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sessions</span>
                  <Tooltip title="创建会话">
                    <Button size="small" type="text" icon={<Plus className="h-3.5 w-3.5" />} onClick={props.onCreateSession} />
                  </Tooltip>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white/50 px-2 py-2">
                  <List
                    size="small"
                    className="soft-scrollbar h-full overflow-y-auto"
                    dataSource={props.canvasSessions}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" /> }}
                    renderItem={(session) => {
                      const active = props.activeSessionId === session.id;
                      return (
                        <List.Item
                          className={`rounded-xl px-2 py-2 ${active ? "bg-white shadow-sm" : ""}`}
                          actions={[
                            <Dropdown
                              key="actions"
                              trigger={["click"]}
                              menu={{
                                items: [{ key: "delete", label: "删除会话", danger: true }],
                                onClick: ({ key }) => {
                                  if (key === "delete") props.onDeleteSession(session.id);
                                },
                              }}
                            >
                              <Button type="text" size="small" icon={<MoreHorizontal className="h-4 w-4" />} />
                            </Dropdown>,
                          ]}
                        >
                          <button onClick={() => props.onSelectSession(session.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <MessageSquare className={`h-3.5 w-3.5 ${active ? "text-emerald-500" : "opacity-50"}`} />
                            <span className="truncate text-xs font-semibold text-slate-700">{session.title}</span>
                          </button>
                        </List.Item>
                      );
                    }}
                  />
                </div>
              </section>

              <section className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/56 px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Library</span>
                  <Tooltip title="上传文档">
                    <Button
                      size="small"
                      type="text"
                      onClick={props.onUpload}
                      disabled={props.isUploading || !props.activeKbId}
                      icon={props.isUploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    />
                  </Tooltip>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white/50 p-2">
                  <List
                    size="small"
                    className="soft-scrollbar h-full overflow-y-auto"
                    dataSource={props.activeDocuments}
                    locale={{
                      emptyText: (
                        <div className="px-2 py-4 text-center">
                          <BookOpenText className="mx-auto h-8 w-8 text-slate-300" />
                          <div className="mt-2 text-xs font-semibold text-slate-500">还没有文档</div>
                        </div>
                      ),
                    }}
                    renderItem={(document) => {
                      const active = props.activePreviewDocId === document.id;
                      return (
                        <List.Item
                          className={`cursor-pointer rounded-xl px-2 ${active ? "bg-white shadow-sm" : ""}`}
                          onClick={() => props.onOpenDocumentPreview(document.id)}
                          actions={[
                            <Dropdown
                              key="doc-actions"
                              trigger={["click"]}
                              menu={{
                                items: [
                                  ...(document.status === "failed" ? [{ key: "retry", label: "重试解析" }] : []),
                                  { key: "delete", label: "删除文档", danger: true },
                                ],
                                onClick: ({ key, domEvent }) => {
                                  domEvent.stopPropagation();
                                  if (key === "retry") props.onRetryDocument(document.id);
                                  if (key === "delete") props.onDeleteDocument(document.id);
                                },
                              }}
                            >
                              <Button type="text" size="small" icon={<MoreHorizontal className="h-4 w-4" />} />
                            </Dropdown>,
                          ]}
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold text-slate-700">{document.file_name}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <Tag bordered={false} className={`${statusTone(document)} m-0 px-2 py-0 text-[10px] font-bold`}>
                                  {document.status}
                                </Tag>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{document.page_count} p</span>
                              </div>
                            </div>
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                </div>
              </section>
            </div>
          </div>
        )}
      </Sider>

      <Content className="min-h-0 min-w-0">
        <GlowCard className="relative h-full min-w-0 overflow-hidden p-0">
          {!props.activeKb ? (
            <div className="flex h-full items-center justify-center p-10">
              <div className="max-w-xl rounded-[2.4rem] bg-white/70 p-10 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Nexus Canvas</div>
                    <div className="mt-2 text-base font-black text-slate-900">先进入一个 Workspace</div>
                  </div>
                </div>
              </div>
            </div>
          ) : props.isBootingAgent ? (
            <div className="flex h-full items-center justify-center p-10">
              <div className="rounded-[2rem] bg-white/75 px-8 py-6 text-sm font-black text-slate-600 shadow-sm">正在连接 pi coding agent...</div>
            </div>
          ) : props.activeAgent ? (
            <div className="agent-shell h-full px-5 py-5">
              <ChatContainer session={props.activeAgent} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-10">
              <div className="rounded-[2rem] bg-white/75 px-8 py-6 text-sm font-black text-rose-500 shadow-sm">Agent 未启动，请查看诊断日志。</div>
            </div>
          )}
        </GlowCard>
      </Content>

      <Sider
        theme="light"
        trigger={null}
        collapsible
        collapsed={rightCollapsed}
        width={430}
        collapsedWidth={56}
        style={{ background: "transparent" }}
        className="h-full"
      >
        {rightCollapsed ? (
          <div className="glass-panel flex h-full flex-col items-center rounded-[2rem] px-1 py-3">
            <Tooltip title="展开预览" placement="left">
              <Button type="text" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setRightCollapsed(false)} />
            </Tooltip>
          </div>
        ) : (
          <GlowCard className="h-full min-h-0 overflow-hidden p-3">
            <div className="mb-3 flex items-start justify-between rounded-2xl bg-white/78 p-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Document Preview</div>
                <div className="mt-1 truncate text-xs font-bold text-slate-600">{props.activePreviewDocName}</div>
              </div>
              <Tooltip title="收起预览">
                <Button type="text" size="small" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setRightCollapsed(true)} />
              </Tooltip>
            </div>
            <div className="min-h-0 h-[calc(100%-5.3rem)]">
              <DocumentPreviewPanel
                title={props.activePreviewDocName}
                content={props.activePreviewMarkdown}
                sourcePath={props.activePreviewSourcePath}
                loading={props.previewLoading}
                error={props.previewError}
              />
            </div>
          </GlowCard>
        )}
      </Sider>
    </Layout>
  );
}
