import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import { supabase } from './supabase'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

const COL_W  = 36
const NAME_W = 220
const ROW_H  = 46
const HEAD_H = 52

// ─────────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────────
const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2)

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

// メモ内のキーワードのスニペットを抽出（前後60文字）
const getSnippet = (text, keyword) => {
  if (!text || !keyword) return null
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 60)
  const end   = Math.min(text.length, idx + keyword.length + 60)
  return {
    before:    text.slice(start, idx),
    match:     text.slice(idx, idx + keyword.length),
    after:     text.slice(idx + keyword.length, end),
    hasPrefix: start > 0,
    hasSuffix: end < text.length,
  }
}

// 日付を「YYYY年M月D日」形式にフォーマット
const fmtDate = (s) => {
  const p = parseDate(s)
  if (!p) return s || ''
  return `${p.y}年${p.m + 1}月${p.d}日`
}

// ガントバーの位置・幅を計算（overrideDates で親タスクの集計日付を上書き可能）
const getBar = (task, year, month, dims, overrideDates) => {
  const startStr = overrideDates?.start_date || task.start_date
  const endStr   = overrideDates?.end_date   || task.end_date
  const ts = parseDate(startStr)
  const te = parseDate(endStr)
  if (!ts || !te) return null

  let startIdx, endIdx

  if (ts.y < year || (ts.y === year && ts.m < month)) {
    startIdx = 0
  } else if (ts.y === year && ts.m === month) {
    startIdx = ts.d - 1
  } else {
    return null
  }

  if (te.y > year || (te.y === year && te.m > month)) {
    endIdx = dims - 1
  } else if (te.y === year && te.m === month) {
    endIdx = te.d - 1
  } else {
    return null
  }

  if (startIdx > endIdx) return null
  return { left: startIdx * COL_W + 2, width: (endIdx - startIdx + 1) * COL_W - 4 }
}

// ─────────────────────────────────────────────────────────────────
// SearchModal
// ─────────────────────────────────────────────────────────────────
function SearchModal({ query, results, notes, onJump, onClose }) {
  const sorted = [...results].sort((a, b) => {
    if (a.start_date < b.start_date) return -1
    if (a.start_date > b.start_date) return  1
    if (a.end_date   < b.end_date)   return -1
    if (a.end_date   > b.end_date)   return  1
    return 0
  })

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="search-modal">
        <div className="search-modal-head">
          <span className="search-modal-title">
            🔍 「{query}」の検索結果 — {sorted.length} 件
          </span>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="search-modal-list">
          {sorted.map(task => {
            const noteText = notes[task.id] || ''
            const snippet  = getSnippet(noteText, query)
            return (
              <button key={task.id} className="search-modal-item" onClick={() => onJump(task)}>
                <div className="smi-top">
                  <StatusBadge status={task.status} />
                  <span className="smi-name">{task.name}</span>
                  <span className="smi-date">
                    {fmtDate(task.start_date)} 〜 {fmtDate(task.end_date)}
                  </span>
                </div>
                {snippet && (
                  <div className="smi-snippet">
                    {snippet.hasPrefix && <span className="snippet-ellipsis">…</span>}
                    {snippet.before}
                    <mark className="snippet-mark">{snippet.match}</mark>
                    {snippet.after}
                    {snippet.hasSuffix && <span className="snippet-ellipsis">…</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

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
// ContextMenu — 右クリックメニュー
// ─────────────────────────────────────────────────────────────────
function ContextMenu({ x, y, task, onAddChild, onClose }) {
  const ref = useRef(null)

  // メニュー外クリック or Escape で閉じる
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // 画面端へのはみ出し補正（簡易）
  const menuW = 170
  const menuH = 44
  const adjustedX = Math.min(x, window.innerWidth  - menuW - 8)
  const adjustedY = Math.min(y, window.innerHeight - menuH - 8)

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        className="context-menu-item"
        onClick={() => { onAddChild(task); onClose() }}
      >
        ＋ 子タスクを追加
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// TaskDialog
// ─────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  name: '', start_date: todayStr, end_date: todayStr,
  progress: 0, status: '待ち', color: '#4A90D9',
}

function TaskDialog({ task, parentTaskName, onSave, onDelete, onClose }) {
  const isNew = !task?.id
  const [form, setForm] = useState(
    isNew ? { ...DEFAULT_FORM, ...task } : { ...DEFAULT_FORM, ...task }
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

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-head">
          <h2>{isNew ? '＋ タスクを追加' : 'タスクを編集'}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* 子タスク追加時: 親タスク名を表示 */}
        {isNew && parentTaskName && (
          <div className="parent-task-hint">
            <span className="parent-task-hint-icon">↳</span>
            <span>親タスク: <strong>{parentTaskName}</strong></span>
          </div>
        )}

        <div className="field">
          <label>タスク名</label>
          <input className="input" value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="例: デザイン作成" autoFocus />
        </div>

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

        <div className="field">
          <label>進捗: <span style={{ color: form.color, fontWeight: 700 }}>{form.progress}%</span></label>
          <input type="range" min="0" max="100" value={form.progress}
            onChange={e => set('progress', Number(e.target.value))}
            style={{ width: '100%', accentColor: form.color }} />
        </div>

        <div className="field">
          <label>状態</label>
          <select className="input" value={form.status}
            onChange={e => set('status', e.target.value)}>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="field">
          <label>バー色</label>
          <div className="color-picker">
            {COLORS.map(c => (
              <button key={c.hex}
                className={`color-dot ${form.color === c.hex ? 'active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => set('color', c.hex)}
                title={c.name} type="button" />
            ))}
          </div>
        </div>

        <div className="dialog-foot">
          {!isNew && (
            <button className="btn btn-danger" onClick={() => onDelete(task.id)}>削除</button>
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
// NotePanel
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
      <textarea className="note-area" value={local}
        onChange={e => handleChange(e.target.value)}
        placeholder="タスクに関するメモを入力… (自動保存)" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// HoursPanel
// ─────────────────────────────────────────────────────────────────
function HoursPanel({ taskId, year, month, hoursMap, onSave }) {
  const dims = daysInMonth(year, month)
  const days = Array.from({ length: dims }, (_, i) => i + 1)

  return (
    <div className="hours-wrap">
      {days.map(d => {
        const w = dow(year, month, d)
        const isSun = w===0, isSat = w===6
        return (
          <div key={d} className={`hours-row${isSun?' sun-row':''}${isSat?' sat-row':''}`}>
            <span className="hours-day">{d}日({DOW[w]})</span>
            <input
              className="hours-input"
              type="number" min="0" max="24" step="0.5"
              value={hoursMap[d] ?? ''}
              onChange={e => onSave(d, e.target.value)}
              placeholder="0"
            />
            <span className="hours-unit">h</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SidePanel
// ─────────────────────────────────────────────────────────────────
function SidePanel({ task, year, month, noteContent, hoursMap, onSaveNote, onSaveHours }) {
  const [tab, setTab] = useState('note')

  if (!task) {
    return <div className="side-empty">タスクを選択するとメモ・工数が表示されます</div>
  }

  return (
    <div className="side-content">
      <div className="side-task-bar">
        <StatusBadge status={task.status} />
        <span className="side-task-name" title={task.name}>{task.name}</span>
      </div>
      <div className="side-tabs">
        <button className={`side-tab${tab==='note'?' active':''}`} onClick={() => setTab('note')}>メモ</button>
        <button className={`side-tab${tab==='hours'?' active':''}`} onClick={() => setTab('hours')}>工数</button>
      </div>
      {tab === 'note'
        ? <NotePanel taskId={task.id} content={noteContent} onChange={onSaveNote} />
        : <HoursPanel taskId={task.id} year={year} month={month} hoursMap={hoursMap} onSave={onSaveHours} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SortableGanttRow — 階層対応
// ─────────────────────────────────────────────────────────────────
function SortableGanttRow({
  task, bar, dims, days, year, month, todayDay,
  selectedId, onSelect, onEdit, onContextMenu,
  isParent, isChild, collapsed, onToggleCollapse,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const sel = task.id === selectedId

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: ROW_H,
    opacity: isDragging ? 0.45 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'gantt-row',
        sel       ? 'selected'   : '',
        isDragging? 'dragging'   : '',
        isParent  ? 'parent-row' : '',
        isChild   ? 'child-row'  : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(task.id)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, task) }}
    >
      {/* 左: タスク名 (sticky) */}
      <div
        className={`gantt-name-cell${sel ? ' sel-name' : ''}`}
        style={{ width: NAME_W }}
      >
        {/* 折りたたみトグル（親タスクのみ）*/}
        {isParent ? (
          <span
            className="collapse-toggle"
            title={collapsed ? '展開' : '折りたたむ'}
            onClick={e => { e.stopPropagation(); onToggleCollapse(task.id) }}
          >
            {collapsed ? '▶' : '▼'}
          </span>
        ) : (
          <span className="collapse-spacer" />
        )}

        {/* 子タスクのインデント */}
        {isChild && <span className="child-indent" />}

        {/* ドラッグハンドル */}
        <span
          className="drag-handle"
          title="ドラッグして並び替え"
          {...attributes}
          {...listeners}
        >⠿</span>

        <StatusBadge status={task.status} />
        <span className="task-text" title={task.name}>{task.name}</span>
        <button className="edit-btn"
          onClick={e => { e.stopPropagation(); onEdit(task) }}
          title="編集">✎</button>
      </div>

      {/* 右: バーエリア */}
      <div className="bar-area"
        style={{ width: dims * COL_W, height: ROW_H, position: 'relative' }}>
        {days.map(d => {
          const w = dow(year, month, d)
          const isSun = w===0, isSat = w===6, isToday = d===todayDay
          if (!isSun && !isSat && !isToday) return null
          return (
            <div key={d}
              className={`col-bg${isSun?' sun-bg':''}${isSat?' sat-bg':''}${isToday?' today-bg':''}`}
              style={{ left: (d-1)*COL_W, width: COL_W }} />
          )
        })}
        {days.map(d => (
          <div key={d} className="col-line" style={{ left: d*COL_W-1 }} />
        ))}
        {bar && (
          <div className="task-bar"
            style={{ left: bar.left, width: bar.width, background: task.color || '#4A90D9' }}>
            <div className="bar-progress" style={{ width: `${task.progress}%` }} />
            {bar.width > 28 && task.progress > 0 && (
              <span className="bar-text">{task.progress}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// GanttChart
// ─────────────────────────────────────────────────────────────────
function GanttChart({
  displayTasks, parentIds, childrenByParent, collapsedIds,
  year, month, selectedId, hasAnyTasks,
  onSelect, onEdit, onContextMenu, onToggleCollapse,
}) {
  const dims = daysInMonth(year, month)
  const days = Array.from({ length: dims }, (_, i) => i + 1)
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate() : -1

  const emptyMessage = hasAnyTasks
    ? 'この月に表示するタスクはありません。\n月を切り替えるか、検索でタスクを探してください。'
    : 'タスクがありません。右上の「＋ タスク追加」から作成してください。'

  // 親タスクの有効日付を子タスクから集計
  const getParentEffectiveDates = (taskId) => {
    const children = childrenByParent[taskId] || []
    if (children.length === 0) return null
    const starts = children.map(c => c.start_date).filter(Boolean).sort()
    const ends   = children.map(c => c.end_date).filter(Boolean).sort()
    return { start_date: starts[0], end_date: ends[ends.length - 1] }
  }

  return (
    <div className="gantt-scroll">
      <div style={{ minWidth: NAME_W + dims * COL_W, width: 'max-content' }}>

        {/* ヘッダー行 */}
        <div className="gantt-head-row" style={{ height: HEAD_H }}>
          <div className="gantt-name-cell head-name" style={{ width: NAME_W }}>
            タスク名 / 状態
          </div>
          {days.map(d => {
            const w = dow(year, month, d)
            return (
              <div key={d}
                className={`gantt-day-head${w===0?' sun':''}${w===6?' sat':''}${d===todayDay?' today':''}`}
                style={{ width: COL_W }}
              >
                <span className="dnum">{d}</span>
                <span className="dname">{DOW[w]}</span>
              </div>
            )
          })}
        </div>

        {/* タスク行 */}
        {displayTasks.length === 0 ? (
          <div className="gantt-empty">
            {emptyMessage.split('\n').map((line, i) => (
              <span key={i}>{line}{i < emptyMessage.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        ) : (
          <SortableContext items={displayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {displayTasks.map(task => {
              const isParent = parentIds.has(task.id)
              const isChild  = !!task.parent_id
              const collapsed = collapsedIds.has(task.id)
              // 親タスクのバーは子の集計から計算
              const overrideDates = isParent ? getParentEffectiveDates(task.id) : null
              return (
                <SortableGanttRow
                  key={task.id}
                  task={task}
                  bar={getBar(task, year, month, dims, overrideDates)}
                  dims={dims}
                  days={days}
                  year={year}
                  month={month}
                  todayDay={todayDay}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onContextMenu={onContextMenu}
                  isParent={isParent}
                  isChild={isChild}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                />
              )
            })}
          </SortableContext>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tasks, setTasks] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [dialog, setDialog] = useState(null)   // null | {} | task
  const [notes, setNotes]   = useState({})
  const [allHours, setAllHours] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [error, setError] = useState(null)

  // ── 階層化: 折りたたみ状態 ──
  const [collapsedIds, setCollapsedIds] = useState(new Set())

  // ── 階層化: コンテキストメニュー ──
  const [contextMenu, setContextMenu] = useState(null) // { x, y, task }

  // ── サイドパネル幅 ──
  const SIDE_MIN = 200
  const SIDE_MAX = 600
  const SIDE_DEFAULT = 300
  const [sideWidth, setSideWidth] = useState(() => {
    const saved = localStorage.getItem('sideWidth')
    const n = saved ? parseInt(saved, 10) : NaN
    return (!isNaN(n) && n >= SIDE_MIN && n <= SIDE_MAX) ? n : SIDE_DEFAULT
  })
  const isResizing = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  // ── 検索 ──
  const [searchQuery,    setSearchQuery]    = useState('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchResults,  setSearchResults]  = useState([])
  const [searchNoResults, setSearchNoResults] = useState(false)

  // ── @dnd-kit センサー ──
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  // ── 派生データ: 親子マップ ──
  const childrenByParent = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.parent_id) {
        if (!map[t.parent_id]) map[t.parent_id] = []
        map[t.parent_id].push(t)
      }
    })
    return map
  }, [tasks])

  const parentIds = useMemo(() => new Set(Object.keys(childrenByParent)), [childrenByParent])

  // ── 派生データ: 親タスクの有効日付（子から集計）──
  const getParentEffectiveDates = useCallback((taskId) => {
    const children = childrenByParent[taskId] || []
    if (children.length === 0) return null
    const starts = children.map(c => c.start_date).filter(Boolean).sort()
    const ends   = children.map(c => c.end_date).filter(Boolean).sort()
    return { start_date: starts[0], end_date: ends[ends.length - 1] }
  }, [childrenByParent])

  // ── 当月表示フィルタ（親タスクは子の集計日付で判定）──
  const monthVisibleTasks = useMemo(() => {
    return tasks.filter(t => {
      let startStr = t.start_date
      let endStr   = t.end_date
      if (parentIds.has(t.id)) {
        const eff = getParentEffectiveDates(t.id)
        if (eff) { startStr = eff.start_date; endStr = eff.end_date }
      }
      const ts = parseDate(startStr)
      const te = parseDate(endStr)
      if (!ts || !te) return false
      if (ts.y > year || (ts.y === year && ts.m > month)) return false
      if (te.y < year || (te.y === year && te.m < month)) return false
      return true
    })
  }, [tasks, year, month, parentIds, getParentEffectiveDates])

  // ── 表示順タスクリスト（親 → 子 の順に並べる）──
  const displayTasks = useMemo(() => {
    const visibleIds = new Set(monthVisibleTasks.map(t => t.id))
    const result = []

    // 最上位タスク（parent_id = null）を sort_order 順に処理
    const topLevel = tasks
      .filter(t => !t.parent_id && visibleIds.has(t.id))
      .sort((a, b) => a.sort_order - b.sort_order)

    topLevel.forEach(parent => {
      result.push(parent)
      // 折りたたまれていなければ子タスクを追加
      if (!collapsedIds.has(parent.id)) {
        const children = (childrenByParent[parent.id] || [])
          .filter(c => visibleIds.has(c.id))
          .sort((a, b) => a.sort_order - b.sort_order)
        children.forEach(c => result.push(c))
      }
    })

    return result
  }, [monthVisibleTasks, tasks, collapsedIds, childrenByParent])

  // ── 折りたたみトグル ──
  const toggleCollapse = useCallback((id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── コンテキストメニュー表示 ──
  const handleContextMenu = useCallback((e, task) => {
    // 子タスクは子タスクを持てない（2階層まで）
    if (task.parent_id) return
    setContextMenu({ x: e.clientX, y: e.clientY, task })
  }, [])

  // ── 子タスク追加ダイアログを開く ──
  const openAddChildDialog = useCallback((parentTask) => {
    setDialog({
      parent_id:  parentTask.id,
      start_date: parentTask.start_date,
      end_date:   parentTask.end_date,
      color:      parentTask.color,
    })
  }, [])

  // ── 検索 ──
  const triggerSearch = () => {
    const q = searchQuery.trim()
    if (!q) return
    const ql = q.toLowerCase()
    const results = tasks.filter(t =>
      t.name.toLowerCase().includes(ql) ||
      (notes[t.id] || '').toLowerCase().includes(ql)
    )
    if (results.length === 0) {
      setSearchNoResults(true)
      setTimeout(() => setSearchNoResults(false), 2000)
      return
    }
    setSearchResults(results)
    setShowSearchModal(true)
  }

  // ── タスク + 全メモ を読み込む共通関数 ──
  const loadData = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const [{ data: taskData, error: taskErr }, { data: noteData }] = await Promise.all([
      supabase.from('tasks').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('task_notes').select('task_id, content'),
    ])

    if (taskErr) {
      setError(taskErr.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setTasks(taskData || [])
    setError(null)

    const noteMap = {}
    noteData?.forEach(n => { noteMap[n.task_id] = n.content || '' })
    setNotes(noteMap)

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [])

  // ── 工数読み込み ──
  const hoursKey = (id, y, m) => `${id}-${y}-${m}`

  const loadHours = useCallback(async (id, y, m) => {
    const key = hoursKey(id, y, m)
    if (allHours[key] !== undefined) return
    const start = toDateStr(y, m, 1)
    const end   = toDateStr(y, m, daysInMonth(y, m))
    const { data } = await supabase.from('task_hours').select('date, hours')
      .eq('task_id', id).gte('date', start).lte('date', end)
    const map = {}
    data?.forEach(r => { map[Number(r.date.split('-')[2])] = r.hours })
    setAllHours(h => ({ ...h, [key]: map }))
  }, [allHours])

  useEffect(() => {
    if (!selectedId) return
    loadHours(selectedId, year, month)
  }, [selectedId, year, month])

  const currentHoursKey = hoursKey(selectedId, year, month)
  const currentHoursMap = allHours[currentHoursKey] || {}
  const noteContent     = notes[selectedId] || ''

  // 検索結果からタスクへジャンプ
  const jumpToTask = (task) => {
    const ts = parseDate(task.start_date)
    if (ts) { setYear(ts.y); setMonth(ts.m) }
    setSelectedId(task.id)
    setSearchQuery('')
    setShowSearchModal(false)
    setSearchResults([])
  }

  // ── @dnd-kit ドラッグ終了（同一階層のみ並び替え）──
  const handleDndEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return

    const activeTask = tasks.find(t => t.id === active.id)
    const overTask   = tasks.find(t => t.id === over.id)
    if (!activeTask || !overTask) return

    // 異なる階層へのドロップは無視
    if (activeTask.parent_id !== overTask.parent_id) return

    // 同一階層グループ内で並び替え
    const sameLevel = tasks
      .filter(t => t.parent_id === activeTask.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const fromIdx = sameLevel.findIndex(t => t.id === active.id)
    const toIdx   = sameLevel.findIndex(t => t.id === over.id)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = arrayMove(sameLevel, fromIdx, toIdx)
    const updatedGroup = reordered.map((t, i) => ({ ...t, sort_order: i }))

    // 全タスクリストに反映
    const updatedMap = {}
    updatedGroup.forEach(t => { updatedMap[t.id] = t })
    setTasks(prev => prev.map(t => updatedMap[t.id] ?? t))

    await Promise.all(
      updatedGroup.map(t =>
        supabase.from('tasks').update({ sort_order: t.sort_order }).eq('id', t.id)
      )
    )
  }

  // ── メモ保存 ──
  const saveNote = async (content) => {
    if (!selectedId) return
    setNotes(n => ({ ...n, [selectedId]: content }))
    await supabase.from('task_notes')
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
    await supabase.from('task_hours')
      .upsert({ task_id: selectedId, date: dateStr, hours: h }, { onConflict: 'task_id,date' })
  }

  // ── タスク保存 ──
  const saveTask = async (taskData) => {
    const parentId = taskData.parent_id || null
    if (!taskData.id) {
      // 同じ親を持つタスク数を sort_order の初期値にする
      const siblings = tasks.filter(t => (t.parent_id || null) === parentId)
      const newTask = {
        ...taskData,
        id: genId(),
        parent_id: parentId,
        sort_order: siblings.length,
      }
      const { data, error } = await supabase.from('tasks').insert(newTask).select().single()
      if (error) { alert('保存に失敗しました: ' + error.message); return }
      setTasks(t => [...t, data])
      setSelectedId(data.id)
    } else {
      const { data, error } = await supabase.from('tasks').update(taskData).eq('id', taskData.id).select().single()
      if (error) { alert('保存に失敗しました: ' + error.message); return }
      setTasks(t => t.map(x => x.id === data.id ? data : x))
    }
    setDialog(null)
  }

  // ── タスク削除（子タスクも一緒に削除される旨を警告）──
  const deleteTask = async (id) => {
    const childCount = (childrenByParent[id] || []).length
    const msg = childCount > 0
      ? `このタスクを削除しますか？\n子タスク（${childCount}件）も一緒に削除されます。`
      : 'このタスクを削除しますか？'
    if (!window.confirm(msg)) return