"use client";

import Image from 'next/image';

// Hard‑coded tenant data – replace with API fetch if needed.
const tenants = [
  {
    name: 'Acme Corp',
    tenantId: 'tenant-001',
    services: [
      { service: 'AppCheck', icon: '/icons/app-check.svg' },
      { service: 'Hosting', icon: '/icons/hosting.svg' },
      { service: 'Auth', icon: '/icons/auth.svg' },
    ],
  },
  {
    name: 'Beta Ltd',
    tenantId: 'tenant-002',
    services: [
      { service: 'AppCheck', icon: '/icons/app-check.svg' },
      { service: 'Hosting', icon: '/icons/hosting.svg' },
      { service: 'Auth', icon: '/icons/auth.svg' },
    ],
  },
];

export default function TenantArchitecture() {
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">Tenant Architecture</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {tenants.map((t) => (
            <div key={t.tenantId} className="p-6 bg-white rounded-2xl shadow-md">
              <h3 className="text-xl font-semibold mb-4 text-center">{t.name}</h3>
              <div className="flex justify-center gap-6">
                {t.services.map((s) => (
                  <div key={s.service} className="flex flex-col items-center">
                    <Image src={s.icon} alt={s.service} width={48} height={48} className="object-contain" />
                    <span className="mt-2 text-sm text-gray-600">{s.service}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
