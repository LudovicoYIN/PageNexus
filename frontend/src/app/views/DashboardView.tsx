import type { KnowledgeBase, DocumentRecord } from "../../lib/types";
import { ChevronRight, Plus, Settings, Trash2 } from "lucide-react";
import type { HTMLAttributes, PropsWithChildren } from "react";

interface Props {
  knowledgeBases: KnowledgeBase[];
  documentsByKb: Record<string, DocumentRecord[]>;
  onOpenSettings: () => void;
  onEnterWorkspace: (knowledgeBase: KnowledgeBase) => void;
  onHoverWorkspace: (knowledgeBase: KnowledgeBase) => void;
  onDeleteKnowledgeBase: (kbId: string, kbName: string) => void;
  onCreateWorkspace: () => void;
}

function GlowCard(props: PropsWithChildren<{ className?: string } & HTMLAttributes<HTMLDivElement>>) {
  const { className, children, ...rest } = props;
  return (
    <div className={`glass-panel rounded-[2rem] ${className ?? ""}`} {...rest}>
      {children}
    </div>
  );
}

export function DashboardView(props: Props) {
  return (
    <div className="soft-scrollbar flex-1 overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.36em] text-slate-400">Workspace Center</p>
            <h1 className="mt-2 text-5xl font-black italic tracking-tight text-slate-900">PageNexus.</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">一个用于文档问答与知识工作流的本地控制台</p>
          </div>
          <button
            onClick={props.onOpenSettings}
            className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm transition-all hover:translate-y-[-1px] hover:shadow-md"
          >
            <Settings className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.knowledgeBases.map((knowledgeBase) => (
            <GlowCard
              key={knowledgeBase.id}
              className="cursor-pointer rounded-[1.5rem] p-4 transition-all hover:-translate-y-0.5"
              onMouseEnter={() => props.onHoverWorkspace(knowledgeBase)}
              onClick={() => props.onEnterWorkspace(knowledgeBase)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.onEnterWorkspace(knowledgeBase);
                }
              }}
            >
              <div className="flex h-full min-h-[160px] flex-col justify-between">
                <div className="text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        knowledgeBase.theme === "green"
                          ? "bg-emerald-500"
                          : knowledgeBase.theme === "yellow"
                            ? "bg-amber-500"
                            : knowledgeBase.theme === "blue"
                              ? "bg-sky-500"
                              : "bg-rose-500"
                      }`}
                    />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">workspace</span>
                  </div>
                  <h3 className="line-clamp-2 text-lg font-black italic tracking-tight text-slate-900">{knowledgeBase.name}</h3>
                  <p className="mt-2 text-xs font-semibold text-slate-500">已解析 {(props.documentsByKb[knowledgeBase.id] ?? []).length} 份文档</p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onDeleteKnowledgeBase(knowledgeBase.id, knowledgeBase.name);
                    }}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onEnterWorkspace(knowledgeBase);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-700" />
                  </button>
                </div>
              </div>
            </GlowCard>
          ))}

          <button
            onClick={props.onCreateWorkspace}
            className="flex min-h-[160px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/45 transition-all hover:border-emerald-400/50 hover:bg-emerald-50/55"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
              <Plus className="h-5 w-5" />
            </div>
            <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Create Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}
