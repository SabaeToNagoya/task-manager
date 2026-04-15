import { useState, useEffect, useRef, useCallback } from 'react'
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

// ガントバーの位置・幅を計算（GanttChart・SortableGanttRow 共用）
const getBar = (task, year, month, dims) => {
  const ts = parseDate(task.start_date)
  const te = parseDate(task.end_date)
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
  // start_date 昇順 → end_date 昇順 でソート
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
// TaskDialog
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

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dialog-head">
          <h2>{isNew ? '＋ タスクを追加' : 'タスクを編集'}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

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
          return (
            <div key={d} className={`hours-row${w===0?' sun':''}${w===6?' sat':''}`}>
              <span className="hours-label">{padStr(d)}日({DOW[w]})</span>
              <input className="hours-input" type="number" min="0" max="24" step="0.5"
                value={hoursMap?.[d] ?? ''} placeholder="0"
                onChange={e => onSave(d, e.target.value)} />
              <span className="hours-unit">h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SidePanel
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
      <div className="side-task-bar">
        <StatusBadge status={task.status} />
        <span className="side-task-name" title={task.name}>{task.name}</span>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='note'?'active':''}`} onClick={() => setTab('note')}>
          📝 メモ
        </button>
        <button className={`tab-btn ${tab==='hours'?'active':''}`} onClick={() => setTab('hours')}>
          ⏱ 工数
        </button>
      </div>
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
// SortableGanttRow — @dnd-kit による並び替え対応行
// ─────────────────────────────────────────────────────────────────
function SortableGanttRow({ task, bar, dims, days, year, month, todayDay, selectedId, onSelect, onEdit }) {
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
      className={`gantt-row${sel ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={() => onSelect(task.id)}
    >
      {/* 左: タスク名 (sticky) */}
      <div
        className={`gantt-name-cell${sel ? ' sel-name' : ''}`}
        style={{ width: NAME_W }}
      >
        {/* ドラッグハンドル: listeners をここにのみ付与 */}
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
  tasks, year, month, selectedId, hasAnyTasks,
  onSelect, onEdit,
}) {
  const dims = daysInMonth(year, month)
  const days = Array.from({ length: dims }, (_, i) => i + 1)
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate() : -1

  // 空メッセージ: タスク自体がないか、この月に該当タスクがないかで分岐
  const emptyMessage = hasAnyTasks
    ? 'この月に表示するタスクはありません。\n月を切り替えるか、検索でタスクを探してください。'
    : 'タスクがありません。右上の「＋ タスク追加」から作成してください。'

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
        {tasks.length === 0 ? (
          <div className="gantt-empty">
            {emptyMessage.split('\n').map((line, i) => (
              <span key={i}>{line}{i < emptyMessage.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        ) : (
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <SortableGanttRow
                key={task.id}
                task={task}
                bar={getBar(task, year, month, dims)}
                dims={dims}
                days={days}
                year={year}
                month={month}
                todayDay={todayDay}
                selectedId={selectedId}
                onSelect={onSelect}
                onEdit={onEdit}
              />
            ))}
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
  const [dialog, setDialog] = useState(null)
  const [notes, setNotes]   = useState({})
  const [allHours, setAllHours] = useState({})
  const [loading, setLoading] = useState(true)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [error, setError] = useState(null)

  // ── 検索 ──
  const [searchQuery,    setSearchQuery]    = useState('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchResults,  setSearchResults]  = useState([])
  const [searchNoResults, setSearchNoResults] = useState(false)

  // ── @dnd-kit センサー設定 ──
  // MouseSensor: マウス専用（8px動いてから開始）
  // TouchSensor: タッチ・iOS専用（250ms長押し後に開始、5px以内のズレは許容）
  // ※ PointerSensor + TouchSensor の組み合わせは iOS で競合するため使わない
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  )

  // ── 検索を実行してモーダルを開く ──
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

  // ── 起動時: タスク + 全メモ を読み込み ──
  useEffect(() => {
    ;(async () => {
      setLoading(true)

      const [{ data: taskData, error: taskErr }, { data: noteData }] = await Promise.all([
        supabase.from('tasks').select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('task_notes').select('task_id, content'),
      ])

      if (taskErr) { setError(taskErr.message); setLoading(false); return }

      setTasks(taskData || [])

      // 全メモを一括キャッシュ (検索に使う)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[n.task_id] = n.content || '' })
      setNotes(noteMap)

      setLoading(false)
    })()
  }, [])

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

  // ── 当月表示フィルタ (ガントチャート用) ──
  const monthVisibleTasks = tasks.filter(t => {
    const ts = parseDate(t.start_date)
    const te = parseDate(t.end_date)
    if (!ts || !te) return false
    if (ts.y > year || (ts.y === year && ts.m > month)) return false
    if (te.y < year || (te.y === year && te.m < month)) return false
    return true
  })

  // 検索結果からタスクへジャンプ（モーダルを閉じる）
  const jumpToTask = (task) => {
    const ts = parseDate(task.start_date)
    if (ts) {
      setYear(ts.y)
      setMonth(ts.m)
    }
    setSelectedId(task.id)
    setSearchQuery('')
    setShowSearchModal(false)
    setSearchResults([])
  }

  // ── @dnd-kit ドラッグ終了ハンドラ ──
  const handleDndEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return

    // monthVisibleTasks 内での並び替えを全タスクに反映
    const newTasks = [...tasks]
    const fromIdx  = newTasks.findIndex(t => t.id === active.id)
    const toIdx    = newTasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(newTasks, fromIdx, toIdx)
    const updated = reordered.map((t, i) => ({ ...t, sort_order: i }))

    setTasks(updated)

    // Supabase に sort_order を一括保存
    await Promise.all(
      updated.map(t =>
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
    if (!taskData.id) {
      const newTask = { ...taskData, id: genId(), sort_order: tasks.length }
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
    if (month === 0) { setYear(y => y-1); setMonth(11) }
    else setMonth(m => m-1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y+1); setMonth(0) }
    else setMonth(m => m+1)
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    setShowMobilePanel(true)
  }

  const selectedTask = tasks.find(t => t.id === selectedId) || null

  const sidePanelProps = {
    task: selectedTask, year, month,
    noteContent, hoursMap: currentHoursMap,
    onSaveNote: saveNote, onSaveHours: saveHours,
  }

  return (
    <div className="app">
      {/* ── ヘッダー ── */}
      <header className="app-header">
        {/* 月ナビ */}
        <div className="month-nav">
          <button className="nav-btn" onClick={prevMonth}>‹</button>
          <button className="nav-btn month-label"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}>
            {year}年 {MONTH_JP[month]}
          </button>
          <button className="nav-btn" onClick={nextMonth}>›</button>
        </div>

        {/* 検索バー */}
        <div className="search-wrap">
          <button className="search-icon-btn" onClick={triggerSearch} aria-label="検索">🔍</button>
          <input
            className="search-input"
            type="search"
            placeholder="タスク・メモを検索… (Enter)"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchNoResults(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') triggerSearch()
              if (e.key === 'Escape') { setSearchQuery(''); setSearchNoResults(false) }
            }}
          />
          {searchQuery && (
            <button className="search-clear"
              onClick={() => { setSearchQuery(''); setSearchNoResults(false) }}
              aria-label="検索クリア">✕</button>
          )}
          {searchNoResults && (
            <div className="search-no-results">該当するタスクはありません</div>
          )}
        </div>

        {/* 右ボタン群 */}
        <div className="header-right">
          {selectedTask && (
            <button className="btn btn-ghost panel-btn"
              onClick={() => setShowMobilePanel(p => !p)}>
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
        <div className="gantt-area">
          {error ? (
            <div className="err-msg">
              <strong>接続エラー:</strong> {error}
              <br /><small>Supabase の接続情報・RLS 設定をご確認ください</small>
            </div>
          ) : loading ? (
            <div className="loading"><span className="spin">⟳</span> 読み込み中…</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDndEnd}
            >
              <GanttChart
                tasks={monthVisibleTasks}
                hasAnyTasks={tasks.length > 0}
                year={year} month={month}
                selectedId={selectedId}
                onSelect={handleSelect}
                onEdit={task => setDialog(task)}
              />
            </DndContext>
          )}
        </div>

        <aside className="side-panel">
          <SidePanel {...sidePanelProps} />
        </aside>
      </div>

      {/* モバイルパネル */}
      {showMobilePanel && selectedTask && (
        <div className="mobile-panel">
          <div className="mobile-panel-bar">
            <span className="mobile-panel-title">{selectedTask.name}</span>
            <button className="icon-btn" onClick={() => setShowMobilePanel(false)}>✕</button>
          </div>
          <div className="mobile-panel-body">
            <SidePanel {...sidePanelProps} />
          </div>
        </div>
      )}

      {/* タスクダイアログ */}
      {dialog !== null && (
        <TaskDialog task={dialog} onSave={saveTask}
          onDelete={deleteTask} onClose={() => setDialog(null)} />
      )}

      {/* 検索モーダル */}
      {showSearchModal && (
        <SearchModal
          query={searchQuery}
          results={searchResults}
          notes={notes}
          onJump={jumpToTask}
          onClose={() => { setShowSearchModal(false); setSearchResults([]) }}
        />
      )}
    </div>
  )
}
