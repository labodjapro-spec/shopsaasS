import { redirect } from 'next/navigation'

export default function MerchantAppRedirect() {
  redirect('/dashboard/settings#application')
}
