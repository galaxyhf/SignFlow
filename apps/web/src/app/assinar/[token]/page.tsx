import { SigningPortal } from "../../../features/signing-portal";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SigningPortal token={token} />;
}
