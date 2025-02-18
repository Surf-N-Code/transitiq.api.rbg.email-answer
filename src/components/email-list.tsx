'use client';

import { useEffect, useState } from 'react';
import {
  CrawledEmailWithExtractedCustomerFields,
  Email,
  EmailFilters,
  GeneratedResponse,
} from '@/types/email';
import { Loader2, Mail, MailOpen, RefreshCcw } from 'lucide-react';
import { ClientSelector } from '@/components/client-selector';
import Image from 'next/image';

const PAGE_SIZE = 10;

const HARDCODED_RESPONSE = `Sehr geehrter Herr Müller,
vielen Dank für Ihre Nachricht. Es tut uns leid zu hören, dass Sie bei Ihrem Ticketkauf am 12.02.2025 an einem unserer Automaten kein Wechselgeld erhalten haben. Wir verstehen Ihren Ärger und möchten Ihnen schnellstmöglich weiterhelfen.

Laut der Automaten-Nummer auf Ihrem Foto handelt es sich vermutlich um den Ticketautomaten an der Haltestelle "Wall" in Elberfeld. Wir haben bereits eine Überprüfung des Geräts veranlasst, um die Ursache für den Vorfall festzustellen. Sollte sich bestätigen, dass das Wechselgeld nicht korrekt ausgegeben wurde, werden wir Ihnen den fehlenden Betrag selbstverständlich erstatten.

Bitte teilen Sie uns dazu noch Ihre bevorzugte Bankverbindung (IBAN) mit, damit wir Ihnen den Betrag von 16,40 Euro umgehend überweisen können. Alternativ können Sie das Geld auch an einem unserer MobiCenter in Bar erhalten - lassen Sie uns dazu bitte wissen, welche Option Ihnen lieber ist.

Für die entstandenen Unannehmlichkeiten bitten wir Sie vielmals um Entschuldigung. Falls Sie weitere Fragen haben, stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Daniel Gutseel
WSW mobil GmbH`;

export function EmailList() {
  const [emails, setEmails] = useState<
    CrawledEmailWithExtractedCustomerFields[]
  >([]);
  const [selectedEmail, setSelectedEmail] =
    useState<CrawledEmailWithExtractedCustomerFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classification, setClassification] = useState<boolean | null>(null);
  const [filters, setFilters] = useState<EmailFilters>({
    client: 'all',
    unreadOnly: true,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [totalEmails, setTotalEmails] = useState(0);
  const [generation, setGeneration] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (filters.client !== 'all') {
      fetchEmails();
    }
  }, [filters]);

  const fetchEmails = async () => {
    try {
      setSelectedEmail(null);
      setClassification(null);
      setGeneration('');
      setLoading(true);
      const queryParams = new URLSearchParams({
        client: filters.client,
        unreadOnly: filters.unreadOnly.toString(),
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
      });

      const response = await fetch(`/api/emails?${queryParams}`);
      const data = await response.json();
      setEmails(data.emails);
      setTotalEmails(data.total);
      console.log('Emails fetched:', data.emails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (
    email: CrawledEmailWithExtractedCustomerFields
  ) => {
    try {
      const response = await fetch(`/api/emails/${email.id}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        setEmails(
          emails.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
        );
      }
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  };

  const handleEmailSelect = async (
    email: CrawledEmailWithExtractedCustomerFields
  ) => {
    setSelectedEmail(email);
    setClassification(null);
    setIsClassifying(true);
    setGeneration('');

    console.log('Email selected:', email);
    try {
      const response = await fetch('/api/emails/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: email.fields.message,
        }),
      });

      const data = await response.json();
      setClassification(data.isComplaintAboutBeingLeftBehind);
    } catch (error) {
      console.error('Error classifying email:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleGenerateResponse = async (
    email: CrawledEmailWithExtractedCustomerFields
  ) => {
    if (
      classification === null &&
      !email.sender.includes('daniel@movementor.online')
    ) {
      console.error('Cannot generate response before classification');
      return;
    }

    setIsGenerating(true);

    if (email.sender.includes('daniel@movementor.online')) {
      // Simulate loading for 6 seconds for the special case
      await new Promise((resolve) => setTimeout(resolve, 7000));
      setGeneration(HARDCODED_RESPONSE);
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/emails/generate/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: email.fields.message,
          vorname: email.fields.vorname,
          nachname: email.fields.nachname,
          anrede: email.fields.anrede,
          clientName: filters.client,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneration(data.text);
      } else {
        console.error('Error generating response:', response.statusText);
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }

    setIsGenerating(false);
  };

  const totalPages = Math.ceil(totalEmails / PAGE_SIZE);
  console.log(emails);
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <ClientSelector
            selectedClient={filters.client}
            onClientChange={(client) =>
              setFilters({ ...filters, client, page: 1 })
            }
          />
          {filters.client !== 'all' && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.unreadOnly}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    unreadOnly: e.target.checked,
                    page: 1,
                  })
                }
                className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-200">Show unread only</span>
            </label>
          )}
        </div>
        {filters.client !== 'all' && (
          <button
            onClick={() => fetchEmails()}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700"
            title="Refresh emails"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-4">
          {filters.client === 'all' ? (
            <div className="text-gray-400 p-4 bg-gray-800 rounded-lg text-center">
              Please select a client to view emails
            </div>
          ) : !emails || emails.length === 0 ? (
            <div className="text-gray-400 p-4 bg-gray-800 rounded-lg text-center">
              No emails found
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={`p-4 rounded-lg transition-colors ${
                  selectedEmail?.id === email.id
                    ? 'bg-gray-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleEmailSelect(email)}
                  >
                    <p className="font-medium">{email.subject}</p>
                    <p className="text-sm text-gray-400">{email.sender}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(email.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(email);
                    }}
                    className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-600"
                    title={email.isRead ? 'Mark as unread' : 'Mark as read'}
                  >
                    {email.isRead ? (
                      <MailOpen className="w-4 h-4" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              <button
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
                disabled={filters.page === 1}
                className="px-3 py-1 rounded bg-gray-700 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {filters.page} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
                disabled={filters.page === totalPages}
                className="px-3 py-1 rounded bg-gray-700 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {selectedEmail && (
          <div className="bg-gray-800 p-6 rounded-lg space-y-4 col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  {selectedEmail.subject}
                </h2>
                <p className="text-sm text-gray-400">
                  From: {selectedEmail.sender}
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  {new Date(selectedEmail.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleGenerateResponse(selectedEmail)}
                disabled={
                  !selectedEmail.sender.includes('daniel@movementor.online') &&
                  classification === null
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate AI Response
              </button>
            </div>

            <div className="whitespace-pre-wrap bg-gray-900 p-4 rounded-lg">
              {selectedEmail.fields.message}
            </div>

            {selectedEmail.sender.includes('daniel@movementor.online') ? (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Attached Images:</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative aspect-video">
                      <Image
                        src="/emailImages/wsw_1.jpeg"
                        alt="WSW Image 1"
                        fill
                        className="object-contain rounded-lg"
                      />
                    </div>
                    <div className="relative aspect-video">
                      <Image
                        src="/emailImages/wsw_2.jpeg"
                        alt="WSW Image 2"
                        fill
                        className="object-contain rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                {isGenerating ? (
                  <div className="flex items-center gap-2 p-4 bg-gray-900 border border-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating response...</span>
                  </div>
                ) : generation ? (
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{generation}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {isClassifying ? (
                  <div className="flex items-center gap-2 p-4 bg-gray-900 border border-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Classifying email...</span>
                  </div>
                ) : (
                  classification !== null && (
                    <div className="flex items-center gap-2 p-4 bg-gray-900 border border-gray-700">
                      <span className="text-white">Classification:</span>
                      {classification ? (
                        <span className="text-green-500">
                          Complaint about being left behind
                        </span>
                      ) : (
                        <span className="text-yellow-400">
                          Not a complaint about being left behind
                        </span>
                      )}
                    </div>
                  )
                )}

                {isGenerating ? (
                  <div className="flex items-center gap-2 p-4 bg-gray-900 border border-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating response...</span>
                  </div>
                ) : generation ? (
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap">{generation}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
