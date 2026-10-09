import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Room from './pages/Room'

// 라우트 정의: URL 경로에 따라 보여줄 화면을 결정한다.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Room />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
