import { EmailList } from '@/components/email-list';

export default function EmailPage() {
  return (
    <div className="min-h-screen bg-[#202124] text-white">
      <div className="container mx-auto px-4 py-24">
        <h1 className="text-4xl mb-8">Unread Emails</h1>
        <EmailList />
      </div>
    </div>
  );
}
