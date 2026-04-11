import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────────────
const COLORS = [
  { name: '青',  hex: '#4A90D9' },
  { name: '緑',  hex: '#27AE60' },
  { name: '橙',  hex: '#E67E22' },
  { name: '赤',  hex: '#E74C3C' },
  { name: '紫',  hex: '#9B59B6' },
  { name: '水色', hex: '#00BCD4' },
]

const STATUS_LIST = ['待ち', '進行中', '完了']

const STATUS_CFG = {
  '待ち':  { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  '進行中': { color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  '完了':  { color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' },
}

const DOW = ['日', '月', '火', '水', '木', '金', '土']
const MONTH_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const COL_W   = 36   // 日付列の幅(px)
const NAME_W  = 220  // タスク名列の幅(px)
const ROW_H   = 46   // 行の高さ(px)
const HEAD_H  = 52   // ヘッダー行の高さ(px)

// ─────────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2)

/** "YYYY-MM-DD" を { y, m(0-base), d } に変換 */
const parseDate = (s) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()

const dow = (y, m, d) => new Date(y, m, d).getDay()

const padStr = (n) => String(n).padStart(2, '0')

const toDateStr = (y, m, d) => `${y}-${padStr(m + 1)}-${padStr(d)}`

const today = new Date()
const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

// ─────────────────────────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG['待ち']
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// TaskDialog — タスク追加・編集ダイアログ
// ─────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  name: '', start_date: todayStr, end_date: todayStr,
  progress: 0, status: '待ち', color: '#4A90D9',
}

function TaskDialog({ task, onSave, onDelete, onClose }) {
  const isNew = !task?.id
  const [form, setForm] = useState(
    isNew ? { ...DEFAULT_FORM } : { ...DEFAULT_FORM, ...task }
  )
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    if (form.start_date > form.end_date) {
      alert('開始日は終了日以前に設定してください')
      return
    }
    onSave({ ...(task || {}), ...form, progress: Number(form.progress) })
  }

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose() }

  return (
    <div className="overlay" onClick={handleOverlay}>
      <div className="dialog">
        {/* ヘッダー */}
        <div className="dialog-head">
          <h2>{isNew ? '＋ タスクを追加' : 'タスクを編集'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        {/* タスク名 */}
        <div className="field">
          <label>タスク名</label>
          <input
            className="input"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="例: デザイン作成"
            autoFocus
          />
        </div>

        {/* 日付 */}
        <div className="field-row">
          <div className="field">
            <label>開始日</label>
            <input className="input" type="date" value={form.start_date}
              onChange={e => set('start_date', e.target.value)} />
          </div>
          <div className="field">
            <label>終了日</label>
            <input className="input" type="date" value={form.end_date}
              onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        {/* 進捗 */}
        <div className="field">
          <label>進捗: <span style={{ color: form.color, fontWeight: 700 }}>{form.progress}%</span></label>
          <input type="range" min="0" max="100" value={form.progress}
            onChange={e => set('progress', Number(e.target.value))}
            style={{ width: '100%', accentColor: form.color }} />
        </div>

        {/* 状態 */}
        <div className="field">
          <label>状態</label>
          <select className="input" value={form.status}
            onChange={e => set('status', e.target.value)}>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* バー色 */}
        <div className="field">
          <label>バー色</label>
          <div className="color-picker">
            {COLORS.map(c => (
              <button key={c.hex}
                className={`color-dot ${form.color === c.hex ? 'active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => set('color', c.hex)}
                title={c.name}
                type="button"
              />
            ))}
          </div>
        </div>

        {/* フッター */}
        <div className="dialog-foot">
          {!isNew && (
            <button className="btn btn-danger"
              onClick={() => onDelete(task.id)}>削除</button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {isNew ? '追加' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// NotePanel — メモパネル
// ─────────────────────────────────────────────────────────────────
function NotePanel({ taskId, content, onChange }) {
  const [local, setLocal] = useState(content || '')
  const timer = useRef(null)

  useEffect(() => { setLocal(content || '') }, [taskId, content])

  const handleChange = (val) => {
    setLocal(val)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(val), 700)
  }

  return (
    <div className="note-wrap">
      <textarea
        className="note-area"
        value={local}
        onChange={e => handleChange(e.target.value)}
        placeholder="タスクに関するメモを入力… (自動保存)"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// HoursPanel — 工数パネル
// ─────────────────────────────────────────────────────────────────
function HoursPanel({ taskId, year, month, hoursMap, onSave }) {
  const days = daysInMonth(year, month)
  const total = Array.from({ length: days }, (_, i) => i + 1)
    .reduce((s, d) => s + (Number(hoursMap?.[d]) || 0), 0)

  return (
    <div className="hours-wrap">
      <div className="hours-total">合計: <strong>{total.toFixed(1)}</strong> h</div>
      <div className="hours-list">
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1
          const w = dow(year, month, d)
          const isSun = w === 0
          const isSat = w === 6
          return (
            <div key={d} className={`hours-row${isSun ? ' sun' : ''}${isSat ? ' sat' : ''}`}>
              <span className="hours-label">
                {padStr(d)}日({DOW[w]})
              </span>
              <input
                className="hours-input"
                type="number" min="0" max="24" step="0.5"
                value={hoursMap?.[d] ?? ''}
                placeholder="0"
                onChange={e => onSave(d, e.target.value)}
              />
              <span className="hours-unit">h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SidePanel — 右サイドパネル (メモ + 工数タブ)
// ─────────────────────────────────────────────────────────────────
function SidePanel({ task, year, month, noteContent, hoursMap, onSaveNote, onSaveHours }) {
  const [tab, setTab] = useState('note')

  if (!task) {
    return (
      <div className="side-empty">
        <div className="side-empty-icon">📋</div>
        <p>タスクを選択すると<br />メモと工数が表示されます</p>
      </div>
    )
  }

  return (
    <div className="side-inner">
      {/* タスク情報 */}
      <div className="side-task-bar">
        <StatusBadge status={task.status} />
        <span className="side-task-name" title={task.name}>{task.name}</span>
      </div>

      {/* タブ切り替え */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'note' ? 'active' : ''}`}
          onClick={() => setTab('note')}
        >📝 メモ</button>
        <button
          className={`tab-btn ${tab === 'hours' ? 'active' : ''}`}
          onClick={() => setTab('hours')}
        >⏱ 工数</button>
      </div>

      {/* コンテンツ */}
      <div className="tab-body">
        {tab === 'note'
          ? <NotePanel taskId={task.id} content={noteContent} onChange={onSaveNote} />
          : <HoursPanel taskId={task.id} year={year} month={month} hoursMap={hoursMap} onSave={onSaveHours} />
        }
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// GanttChart — ガントチャート
// ─────────────────────────────────────────────────────────────────
function GanttChart({ tasks, year, month, selectedId, onSelect, onEdit }) {
  const dims = daysInMonth(year, month)
  const days = Array.from({ length: dims }, (_, i) => i + 1)
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate() : -1

  /** タスクバーの left / width を計算 (px) */
  const getBar = (task) => {
    const ts = parseDate(task.start_date)
    const te = parseDate(task.end_date)
    if (!ts || !te) return null

    let startIdx, endIdx

    // startIdx: 月内での 0-based 開始インデックス
    if (ts.y < year || (ts.y === year && ts.m < month)) {
      startIdx = 0
    } else if (ts.y === year && ts.m === month) {
      startIdx = ts.d - 1
    } else {
      return null // タスクが今月より後に開始
    }

    // endIdx: 月内での 0-based 終了インデックス
    if (te.y > year || (te.y === year && te.m > month)) {
      endIdx = dims - 1
    } else if (te.y === year && te.m === month) {
      endIdx = te.d - 1
    } else {
      return null // タスクが今月より前に終了
    }

    if (startIdx > endIdx) return null

    return {
      left:  startIdx * COL_W + 2,
      width: (endIdx - startIdx + 1) * COL_W - 4,
    }
  }

  return (
    <div className="gantt-scroll">
      <div style={{ minWidth: NAME_W + dims * COL_W, width: 'max-content' }}>

        {/* ─── ヘッダー行 ─── */}
        <div className="gantt-head-row" style={{ height: HEAD_H }}>
          <div
            className="gantt-name-cell head-name"
            style={{ width: NAME_W }}
          >
            タスク名 / 状態
          </div>
          {days.map(d => {
            const w = dow(year, month, d)
            const isSun = w === 0, isSat = w === 6
            const isToday = d === todayDay
            return (
              <div key={d}
                className={`gantt-day-head${isSun?' sun':''}${isSat?' sat':''}${isToday?' today':''}`}
                style={{ width: COL_W }}
              >
                <span className="dnum">{d}</span>
                <span className="dname">{DOW[w]}</span>
              </div>
            )
          })}
        </div>

        {/* ─── タスク行 ─── */}
        {tasks.length === 0 ? (
          <div className="gantt-empty">
            タスクがありません。右上の「＋ タスク追加」から作成してください。
          </div>
        ) : tasks.map(task => {
          const bar = getBar(task)
          const sel = task.id === selectedId
          return (
            <div key={task.id}
              className={`gantt-row${sel ? ' selected' : ''}`}
              style={{ height: ROW_H }}
              onClick={() => onSelect(task.id)}
            >
              {/* 左: タスク名 (sticky) */}
              <div
                className={`gantt-name-cell${sel ? ' sel-name' : ''}`}
                style={{ width: NAME_W }}
              >
                <StatusBadge status={task.status} />
                <span className="task-text" title={task.name}>{task.name}</span>
                <button
                  className="edit-btn"
                  onClick={e => { e.stopPropagation(); onEdit(task) }}
                  title="編集"
                  aria-label="タスクを編集"
                >✎</button>
              </div>

              {/* 右: バーエリア */}
              <div
                className="bar-area"
                style={{ width: dims * COL_W, height: ROW_H, position: 'relative' }}
              >
                {/* 列背景 (週末・今日) */}
                {days.map(d => {
                  const w = dow(year, month, d)
                  const isSun = w === 0, isSat = w === 6
                  const isToday = d === todayDay
                  if (!isSun && !isSat && !isToday) return null
                  return (
                    <div key={d}
                      className={`col-bg${isSun?' sun-bg':''}${isSat?' sat-bg':''}${isToday?' today-bg':''}`}
                      style={{ left: (d - 1) * COL_W, width: COL_W }}
                    />
                  )
                })}

                {/* グリッド線 */}
                {days.map(d => (
                  <div key={d} className="col-line"
                    style={{ left: d * COL_W - 1 }} />
                ))}

                {/* タスクバー */}
                {bar && (
                  <div
                    className="task-bar"
                    style={{
                      left: bar.left,
                      width: bar.width,
                      background: task.color || '#4A90D9',
                    }}
                  >
                    {/* 進捗オーバーレイ */}
                    <div
                      className="bar-progress"
                      style={{ width: `${task.progress}%` }}
                    />
                    {/* 進捗テキスト */}
                    {bar.width > 28 && task.progress > 0 && (
                      <span className="bar-text">{task.progress}%</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// App — メインコンポーネント
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tasks, setTasks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [dialog, setDialog]   = useState(null)   // null | {} | task
  const [notes, setNotes]     = useState({})      // taskId → string
  const [allHours, setAllHours] = useState({})    // `${taskId}-${y}-${m}` → {day→h}
  const [loading, setLoading] = useState(true)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [error, setError] = useState(null)

  // ── タスク読み込み ──
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) { setError(error.message); setLoading(false); return }
      setTasks(data || [])
      setLoading(false)
    })()
  }, [])

  // ── メモ読み込み ──
  const loadNote = useCallback(async (id) => {
    if (notes[id] !== undefined) return
    const { data } = await supabase
      .from('task_notes')
      .select('content')
      .eq('task_id', id)
      .maybeSingle()
    setNotes(n => ({ ...n, [id]: data?.content || '' }))
  }, [notes])

  // ── 工数読み込み ──
  const hoursKey = (id, y, m) => `${id}-${y}-${m}`

  const loadHours = useCallback(async (id, y, m) => {
    const key = hoursKey(id, y, m)
    if (allHours[key] !== undefined) return
    const start = toDateStr(y, m, 1)
    const end   = toDateStr(y, m, daysInMonth(y, m))
    const { data } = await supabase
      .from('task_hours')
      .select('date, hours')
      .eq('task_id', id)
      .gte('date', start)
      .lte('date', end)
    const map = {}
    data?.forEach(r => { map[Number(r.date.split('-')[2])] = r.hours })
    setAllHours(h => ({ ...h, [key]: map }))
  }, [allHours])

  // 選択タスク or 月変更時にデータ取得
  useEffect(() => {
    if (!selectedId) return
    loadNote(selectedId)
    loadHours(selectedId, year, month)
  }, [selectedId, year, month])

  const currentHoursKey = hoursKey(selectedId, year, month)
  const currentHoursMap = allHours[currentHoursKey] || {}
  const noteContent     = notes[selectedId] || ''

  // ── メモ保存 ──
  const saveNote = async (content) => {
    if (!selectedId) return
    setNotes(n => ({ ...n, [selectedId]: content }))
    await supabase
      .from('task_notes')
      .upsert({ task_id: selectedId, content }, { onConflict: 'task_id' })
  }

  // ── 工数保存 ──
  const saveHours = async (day, val) => {
    if (!selectedId) return
    const h = parseFloat(val) || 0
    setAllHours(ah => ({
      ...ah,
      [currentHoursKey]: { ...currentHoursMap, [day]: h },
    }))
    const dateStr = toDateStr(year, month, day)
    await supabase
      .from('task_hours')
      .upsert(
        { task_id: selectedId, date: dateStr, hours: h },
        { onConflict: 'task_id,date' }
      )
  }

  // ── タスク保存 ──
  const saveTask = async (taskData) => {
    if (!taskData.id) {
      // 新規
      const newTask = { ...taskData, id: genId(), sort_order: tasks.length }
      const { data, error } = await supabase
        .from('tasks').insert(newTask).select().single()
      if (error) { alert('保存に失敗しました: ' + error.message); return }
      setTasks(t => [...t, data])
      setSelectedId(data.id)
    } else {
      // 更新
      const { data, error } = await supabase
        .from('tasks').update(taskData).eq('id', taskData.id).select().single()
      if (error) { alert('保存に失敗しました: ' + error.message); return }
      setTasks(t => t.map(x => x.id === data.id ? data : x))
    }
    setDialog(null)
  }

  // ── タスク削除 ──
  const deleteTask = async (id) => {
    if (!window.confirm('このタスクを削除しますか？')) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { alert('削除に失敗しました: ' + error.message); return }
    setTasks(t => t.filter(x => x.id !== id))
    if (selectedId === id) setSelectedId(null)
    setDialog(null)
  }

  // ── 月ナビ ──
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    setShowMobilePanel(true)
  }

  const selectedTask = tasks.find(t => t.id === selectedId) || null

  const sidePanelProps = {
    task: selectedTask,
    year, month,
    noteContent,
    hoursMap: currentHoursMap,
    onSaveNote: saveNote,
    onSaveHours: saveHours,
  }

  return (
    <div className="app">
      {/* ── ヘッダー ── */}
      <header className="app-header">
        <div className="month-nav">
          <button className="nav-btn" onClick={prevMonth} aria-label="前月">‹</button>
          <button className="nav-btn month-label" onClick={goToday}>
            {year}年 {MONTH_JP[month]}
          </button>
          <button className="nav-btn" onClick={nextMonth} aria-label="次月">›</button>
        </div>

        <div className="header-right">
          {selectedTask && (
            <button
              className="btn btn-ghost panel-btn"
              onClick={() => setShowMobilePanel(p => !p)}
              aria-label="パネルを開く"
            >
              {showMobilePanel ? '✕' : '📋'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setDialog({})}>
            ＋ タスク追加
          </button>
        </div>
      </header>

      {/* ── メイン ── */}
      <div className="app-body">
        {/* ガントチャートエリア */}
        <div className="gantt-area">
          {error ? (
            <div className="err-msg">
              <strong>接続エラー:</strong> {error}
              <br /><small>Supabase の接続情報・RLS 設定をご確認ください</small>
            </div>
          ) : loading ? (
            <div className="loading">
              <span className="spin">⟳</span> 読み込み中…
            </div>
          ) : (
            <GanttChart
              tasks={tasks}
              year={year}
              month={month}
              selectedId={selectedId}
              onSelect={handleSelect}
              onEdit={task => setDialog(task)}
            />
          )}
        </div>

        {/* サイドパネル (デスクトップ) */}
        <aside className="side-panel">
          <SidePanel {...sidePanelProps} />
        </aside>
      </div>

      {/* モバイル用ボトムパネル */}
      {showMobilePanel && selectedTask && (
        <div className="mobile-panel" role="dialog" aria-modal="true">
          <div className="mobile-panel-bar">
            <span className="mobile-panel-title">{selectedTask.name}</span>
            <button
              className="icon-btn"
              onClick={() => setShowMobilePanel(false)}
              aria-label="パネルを閉じる"
            >✕</button>
          </div>
          <div className="mobile-panel-body">
            <SidePanel {...sidePanelProps} />
          </div>
        </div>
      )}

      {/* タスクダイアログ */}
      {dialog !== null && (
        <TaskDialog
          task={dialog}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
