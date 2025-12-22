export default function Home() {
  return (
    <div>
      {/* Carousel Section */}
      <section className="relative h-[60vh] min-h-[500px] bg-gray-800 overflow-hidden">
        <h2 className="absolute top-5 left-1/2 -translate-x-1/2 text-white text-2xl z-10">
          船舶场景导航门户
        </h2>
        {/* Placeholder for the 3D model and carousel content */}
        <div className="w-full h-full flex items-center justify-center text-white">
          Carousel and 3D Model will be here
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Learning Cockpit */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">学习驾驶舱</h3>
              {/* Placeholder for radar chart */}
              <div className="h-64 bg-gray-200 rounded-md flex items-center justify-center">
                Radar Chart
              </div>
            </div>
            {/* Today's Recommended Tasks */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">今日推荐工卡</h3>
              {/* Placeholder for task list */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-100 rounded-md">Task 1</div>
                <div className="p-4 bg-gray-100 rounded-md">Task 2</div>
                <div className="p-4 bg-gray-100 rounded-md">Task 3</div>
              </div>
            </div>
            {/* AI Assistant */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">AI助教即时问答</h3>
              {/* Placeholder for chat */}
              <div className="h-64 bg-gray-200 rounded-md flex flex-col p-4">
                <div className="bg-blue-500 text-white p-2 rounded-lg self-start mb-2">AI: Hello!</div>
                <div className="bg-gray-300 p-2 rounded-lg self-end">User: Hi!</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
