export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          AI-OBE船舶控制平台
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          智能海事教育平台 - 测试版本
        </p>
        <div className="space-y-4">
          <div className="p-4 bg-blue-100 rounded-lg">
            <h2 className="font-semibold text-blue-800">功能模块</h2>
            <ul className="mt-2 text-blue-700">
              <li>• AI助教工坊</li>
              <li>• 伦理决策沙盒</li>
              <li>• 知识图谱系统</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}