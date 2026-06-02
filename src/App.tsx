import { useEffect } from "react";
import { useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { SkillList } from "./components/SkillList";
import { SkillDetail } from "./components/SkillDetail";
import { SettingsModal } from "./components/SettingsModal";
import { MoveModal } from "./components/MoveModal";

function DeleteModal() {
  const skill = useStore((s) => s.pendingDelete);
  const cancel = useStore((s) => s.requestDelete);
  const confirm = useStore((s) => s.confirmDelete);
  if (!skill) return null;
  return (
    <div className="scrim" onClick={() => cancel(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>卸载「{skill.name}」？</h3>
        <p>
          这会永久删除目录 <b>{skill.path.replace(/^\/Users\/[^/]+/, "~")}</b> 及其全部文件，无法撤销。
          如果只是想临时关闭，用列表里的开关「禁用」即可。
        </p>
        <div className="modal-actions">
          <button className="abtn" onClick={() => cancel(null)}>
            取消
          </button>
          <button className="abtn solid-danger" onClick={() => confirm()}>
            永久卸载
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      <div className="app">
        <Sidebar />
        <SkillList />
        <SkillDetail />
      </div>
      <DeleteModal />
      <MoveModal />
      <SettingsModal />
    </>
  );
}
