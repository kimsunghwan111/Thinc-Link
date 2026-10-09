// JavaScript 실행용 Worker의 "준비 코드".
// 사용자 코드가 실행되기 전에 먼저 불러와서(importScripts) 다음을 준비한다.
//  - console.log/info/warn/error 등을 가로채 메인 화면으로 전달
//  - 객체·배열 등을 읽기 쉬운 문자열로 변환
//  - 타이머/fetch 대기 상태를 추적해 "코드가 모두 끝났는지" 판단
//  - 처리되지 않은 Promise 오류(unhandledrejection)와 비동기 오류 보고
// 이 파일은 클래식(일반) 스크립트로 실행되므로 import/export를 쓸 수 없다.
;(() => {
  // 사용자 코드는 Worker 본문의 2번째 줄부터 시작한다. (1번째 줄은 이 파일을 불러오는 코드)
  const LINE_OFFSET = 1
  const MAX_DEPTH = 4
  const MAX_ITEMS = 100
  const INLINE_LIMIT = 72

  const post = (message) => self.postMessage(message)
  const origSetTimeout = self.setTimeout.bind(self)
  const origClearTimeout = self.clearTimeout.bind(self)
  const origSetInterval = self.setInterval.bind(self)
  const origClearInterval = self.clearInterval.bind(self)
  const origFetch = typeof self.fetch === 'function' ? self.fetch.bind(self) : null

  // ---------- 값 → 문자열 ----------
  const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
  const keyOf = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k))

  // 오류 스택에서 "사용자 코드의 줄 번호"를 찾는다. (Worker 본문 URL:줄:열 형태)
  const lineFromStack = (stack) => {
    if (typeof stack !== 'string') return null
    const escaped = self.location.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = stack.match(new RegExp(`${escaped}:(\\d+):\\d+`))
    if (!match) return null
    const line = Number(match[1]) - LINE_OFFSET
    return line >= 1 ? line : null
  }

  const describeError = (err) => {
    const name = err && err.name ? err.name : 'Error'
    const message = err && err.message !== undefined ? err.message : String(err)
    const line = lineFromStack(err && err.stack)
    return `${name}: ${message}${line ? ` (줄 ${line})` : ''}`
  }

  const inspect = (value, depth, seen) => {
    switch (typeof value) {
      case 'string':
        return depth === 0 ? value : quote(value)
      case 'number':
      case 'boolean':
      case 'undefined':
        return String(value)
      case 'bigint':
        return `${value}n`
      case 'symbol':
        return value.toString()
      case 'function':
        return `[Function: ${value.name || '(익명)'}]`
    }
    if (value === null) return 'null'
    if (value instanceof Error) return describeError(value)
    if (seen.includes(value)) return '[Circular]'
    if (value instanceof Date) return isNaN(value) ? 'Invalid Date' : value.toISOString()
    if (value instanceof RegExp) return String(value)
    if (depth > MAX_DEPTH) return Array.isArray(value) ? '[Array]' : '[Object]'

    const next = seen.concat([value])
    const child = (v) => inspect(v, depth + 1, next)
    let parts
    let open = '{'
    let close = '}'
    let prefix = ''

    if (Array.isArray(value)) {
      open = '['
      close = ']'
      parts = value.slice(0, MAX_ITEMS).map(child)
      if (value.length > MAX_ITEMS) parts.push(`... ${value.length - MAX_ITEMS}개 더`)
    } else if (value instanceof Map) {
      prefix = `Map(${value.size}) `
      parts = Array.from(value).slice(0, MAX_ITEMS).map(([k, v]) => `${child(k)} => ${child(v)}`)
    } else if (value instanceof Set) {
      prefix = `Set(${value.size}) `
      parts = Array.from(value).slice(0, MAX_ITEMS).map(child)
    } else {
      const ctor = value.constructor && value.constructor.name
      if (ctor && ctor !== 'Object') prefix = `${ctor} `
      const keys = Object.keys(value)
      parts = keys.slice(0, MAX_ITEMS).map((k) => `${keyOf(k)}: ${child(value[k])}`)
      if (keys.length > MAX_ITEMS) parts.push(`... ${keys.length - MAX_ITEMS}개 더`)
    }

    if (parts.length === 0) return `${prefix}${open}${close}`
    const inline = `${prefix}${open} ${parts.join(', ')} ${close}`
    if (inline.length <= INLINE_LIMIT && !inline.includes('\n')) return inline
    const pad = '  '.repeat(depth + 1)
    return `${prefix}${open}\n${pad}${parts.join(`,\n${pad}`)}\n${'  '.repeat(depth)}${close}`
  }

  const format = (args) =>
    args
      .map((a) => {
        try {
          return inspect(a, 0, [])
        } catch (e) {
          return `[출력할 수 없는 값: ${e && e.message}]`
        }
      })
      .join(' ')

  // ---------- console 가로채기 ----------
  const emit = (kind) => (...args) => post({ type: 'out', kind, text: format(args) })
  const fakeConsole = {
    log: emit('log'),
    debug: emit('log'),
    dir: emit('log'),
    table: emit('log'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    trace: emit('error'),
    assert: (cond, ...args) => {
      if (!cond) post({ type: 'out', kind: 'error', text: `Assertion failed: ${format(args)}` })
    },
    clear: () => {},
  }
  Object.assign(self.console, fakeConsole)

  // ---------- 대기 중인 작업 추적 ----------
  let pendingTimers = 0
  let pendingFetches = 0
  const activeTimeouts = new Set()
  const activeIntervals = new Set()

  self.setTimeout = (fn, ms, ...rest) => {
    pendingTimers++
    const id = origSetTimeout(
      (...a) => {
        activeTimeouts.delete(id)
        pendingTimers--
        if (typeof fn === 'function') fn(...a)
      },
      ms,
      ...rest,
    )
    activeTimeouts.add(id)
    return id
  }
  self.clearTimeout = (id) => {
    if (activeTimeouts.delete(id)) pendingTimers--
    origClearTimeout(id)
  }
  // setInterval은 clearInterval로 끝내기 전까지 "진행 중"으로 본다. (끝내지 않으면 시간 제한에 걸린다)
  self.setInterval = (fn, ms, ...rest) => {
    pendingTimers++
    const id = origSetInterval(fn, ms, ...rest)
    activeIntervals.add(id)
    return id
  }
  self.clearInterval = (id) => {
    if (activeIntervals.delete(id)) pendingTimers--
    origClearInterval(id)
  }
  if (origFetch) {
    self.fetch = (...args) => {
      pendingFetches++
      return origFetch(...args).finally(() => {
        pendingFetches--
      })
    }
  }

  // ---------- 종료 처리 ----------
  let finished = false
  const finish = (ok) => {
    if (finished) return
    finished = true
    post({ type: 'done', ok })
  }

  // 사용자 코드(async 함수로 감싸져 있음)가 끝난 뒤 호출된다.
  // 타이머·fetch가 모두 끝나고 몇 번의 틱 동안 새 작업이 없을 때까지 기다렸다가 종료를 알린다.
  self.__runnerFinish = () => {
    let quiet = 0
    const check = () => {
      if (finished) return
      if (pendingTimers === 0 && pendingFetches === 0) {
        quiet++
        if (quiet >= 3) return finish(true)
      } else {
        quiet = 0
      }
      origSetTimeout(check, 0)
    }
    origSetTimeout(check, 0)
  }

  self.__runnerFail = (err) => {
    post({ type: 'out', kind: 'error', text: describeError(err) })
    finish(false)
  }

  // 아무도 catch하지 않은 Promise 오류
  self.addEventListener('unhandledrejection', (event) => {
    event.preventDefault()
    post({ type: 'out', kind: 'error', text: `처리되지 않은 Promise 오류 - ${describeError(event.reason)}` })
    finish(false)
  })
})()
