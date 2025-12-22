import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { FaShip, FaTachometerAlt, FaTasks, FaRobot } from "react-icons/fa";

export default function DashboardPage() {
  return (
    <div className="bg-gray-50 text-gray-800">
      {/* Hero Section with Carousel */}
      <section className="relative h-[60vh] min-h-[500px] bg-blue-900 text-white">
        <Carousel className="w-full h-full">
          <CarouselContent>
            <CarouselItem>
              <div className="grid grid-cols-2 h-full">
                <div className="flex flex-col justify-center p-10">
                  <h2 className="text-4xl font-bold mb-4">动力定位船抗风浪控制</h2>
                  <p className="mb-6">
                    体验先进的船舶动力定位系统，��习多推进器协调控制策略，在复杂海况下保持船舶稳定。
                  </p>
                  <Button size="lg" className="bg-red-600 hover:bg-red-700 w-fit">
                    开启任务链
                  </Button>
                </div>
                <div className="bg-blue-800 h-full flex items-center justify-center">
                  <FaShip className="text-9xl" />
                </div>
              </div>
            </CarouselItem>
            {/* Add other carousel items here */}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </section>

      {/* Core Features Section */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaTachometerAlt className="mr-2" />
                  学习驾驶舱
                </CardTitle>
                <CardDescription>个性化学��路径</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Content for learning cockpit */}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaTasks className="mr-2" />
                  今日推荐工卡
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content for recommended tasks */}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FaRobot className="mr-2" />
                  AI助教即时问答
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Content for AI assistant */}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
