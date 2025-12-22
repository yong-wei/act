import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-white shadow">
        <nav className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-700">
              <Link to="/">智能船舶自主控制系统</Link>
            </div>
            <div className="flex items-center">
              <Link to="/" className="text-gray-600 hover:text-gray-800 px-3 py-2">首页</Link>
              <Link to="/ai" className="text-gray-600 hover:text-gray-800 px-3 py-2">AI助教</Link>
              <Link to="/ethics" className="text-gray-600 hover:text-gray-800 px-3 py-2">伦理</Link>
              <Link to="/knowledge" className="text-gray-600 hover:text-gray-800 px-3 py-2">知识库</Link>
              <Link to="/pid-simulator" className="text-gray-600 hover:text-gray-800 px-3 py-2">PID仿真</Link>
              <Link to="/argument-principle" className="text-gray-600 hover:text-gray-800 px-3 py-2">幅角原理</Link>
              <Link to="/background" className="text-gray-600 hover:text-gray-800 px-3 py-2">后台管理</Link>
              <Link to="/personal" className="text-gray-600 hover:text-gray-800 px-3 py-2">个人中心</Link>
            </div>
          </div>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
