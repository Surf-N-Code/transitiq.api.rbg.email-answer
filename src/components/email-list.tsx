'use client';

import { useEffect, useState } from 'react';
import { Email, EmailFilters, GeneratedResponse } from '@/types/email';
import { Loader2, Mail, MailOpen, RefreshCcw } from 'lucide-react';
import { ClientSelector } from '@/components/client-selector';

const PAGE_SIZE = 10;

export function EmailList() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
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

  const handleMarkAsRead = async (email: Email) => {
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

  const handleEmailSelect = async (email: Email) => {
    setSelectedEmail(email);
    setClassification(null);
    setIsClassifying(true);

    console.log('Email selected:', email);
    try {
      const response = await fetch('/api/emails/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: email.text,
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

  const handleGenerateResponse = async (email: Email) => {
    if (classification === null) {
      console.error('Cannot generate response before classification');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/message/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: email.text,
          vorname: email.fields.vorname,
          nachname: email.fields.nachname,
          anrede: email.fields.anrede,
          clientName: filters.client,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneration(data.finalResponse);
      } else {
        console.error('Error generating response:', response.statusText);
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }

    setIsGenerating(false);
  };

  const totalPages = Math.ceil(totalEmails / PAGE_SIZE);

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
                disabled={classification === null}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate AI Response
              </button>
            </div>

            <div className="whitespace-pre-wrap bg-gray-900 p-4 rounded-lg">
              {selectedEmail.text}
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
