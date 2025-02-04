'use client';

import { Client } from '@/types/email';

interface ClientSelectorProps {
  selectedClient: Client | 'all';
  onClientChange: (client: Client | 'all') => void;
}

export function ClientSelector({
  selectedClient,
  onClientChange,
}: ClientSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <label
        htmlFor="client-select"
        className="text-sm font-medium text-gray-200"
      >
        Client:
      </label>
      <select
        id="client-select"
        value={selectedClient}
        onChange={(e) => onClientChange(e.target.value as Client | 'all')}
        className="bg-gray-700 text-white rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        <option value="all">All Clients</option>
        <option value="rheinbahn">Rheinbahn</option>
        <option value="wsw">WSW</option>
      </select>
    </div>
  );
}
