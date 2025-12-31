import { redirect } from 'next/navigation';

/**
 * Lesson 02 页面已迁移到数据库驱动的单页资源
 * 自动重定向到互动学习主页面
 */
export default function Lesson02Page() {
  redirect('/interactive-learning');
}
