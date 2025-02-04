'use client';

import { useEffect, useState } from 'react';
import { Email, GeneratedResponse } from '@/types/email';
import { Loader2 } from 'lucide-react';
import { Fields } from '@/app/api/fetchMails/route';

export function EmailList() {
  const [emails, setEmails] = useState<Fields[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Fields | null>(null);
  const [generatedResponse, setGeneratedResponse] =
    useState<GeneratedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await fetch('/api/fetchMails');
      const data = await response.json();
      setEmails(data.emails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = async (fields: Fields) => {
    console.log('Fields:', fields);
    setSelectedEmail(fields);
    setGeneratedResponse({
      response: '',
      status: 'loading',
      isComplaintAboutBeingLeftBehind: false,
    });

    try {
      const response = await fetch('/api/message/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fields.message,
          vorname: fields.vorname,
          nachname: fields.nachname,
          anrede: fields.anrede,
        }),
      });

      const data = await response.json();
      setGeneratedResponse({
        response: data.finalResponse,
        status: 'complete',
        isComplaintAboutBeingLeftBehind: data.isComplaintAboutBeingLeftBehind,
      });
    } catch (error) {
      console.error('Error generating response:', error);
      setGeneratedResponse({
        response: 'Error generating response',
        status: 'error',
        isComplaintAboutBeingLeftBehind: false,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  console.log('Emails:', emails);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        {!emails || emails.length === 0 ? (
          <div className="text-gray-400">
            Keine ungelesenen E-Mails gefunden
          </div>
        ) : (
          emails?.map((email) => (
            <div
              key={email.id}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedEmail?.id === email.id
                  ? 'bg-gray-700'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => handleEmailClick(email)}
            >
              <p className="font-medium">{email.subject}</p>
              <p className="text-sm text-gray-400">{email.sender}</p>
              <p className="text-sm text-gray-400">{email.from}</p>
              <p className="text-sm text-gray-400">
                {email.anrede} {email.vorname} {email.nachname}
              </p>
              <p className="text-sm text-gray-400">{email.email}</p>
              <p className="text-sm text-gray-400">
                {new Date(email.date).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>

      {selectedEmail && (
        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {selectedEmail.subject}
            </h2>
            <p className="text-sm text-gray-400">From: {selectedEmail.from}</p>
            <p className="text-sm text-gray-400 mb-4">
              {new Date(selectedEmail.date).toLocaleString()}
            </p>
            <p className="whitespace-pre-wrap">{selectedEmail.text}</p>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Kundenanliegen</h3>
            {selectedEmail.message}

            <h3 className="text-lg font-semibold mb-2 mt-8">
              Generated Response
            </h3>
            {generatedResponse?.status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            ) : generatedResponse?.status === 'complete' ? (
              <>
                <div className="flex items-center gap-2 p-4 bg-[#303134] border border-[#5f6368]">
                  <span className="text-white">Klassifizierung:</span>
                  {generatedResponse.isComplaintAboutBeingLeftBehind ? (
                    <span className="text-yellow-400">
                      Beschwerde über Zurücklassen am Bahnhof
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      Keine Beschwerde über "Zurücklassen an der Haltestellt"
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap mt-6">
                  {generatedResponse.response}
                </p>
              </>
            ) : generatedResponse?.status === 'error' ? (
              <p className="text-red-400">Error generating response</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
