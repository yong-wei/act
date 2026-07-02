import { redirect } from 'next/navigation';

export default function VirtualLabPage() {
  redirect('/simulations?compat=virtual-lab');
}
