import { redirect } from 'next/navigation';

/**
 * Physics Modeling 页面已迁移到数据库驱动的单页资源
 * 自动重定向到互动学习主页面
 */
export default function PhysicsModelingPage() {
  redirect('/interactive-learning');
}
