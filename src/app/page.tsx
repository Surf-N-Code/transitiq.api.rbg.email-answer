import { EmailClassificationForm } from "@/components/email-classification-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#202124] text-white">
      <div className="container mx-auto px-4 py-24 max-w-3xl flex flex-col items-center">
        <h1 className="text-4xl mb-8 text-center">
          Email classification and ai response
        </h1>
        <EmailClassificationForm />
      </div>
    </div>
  );
}
