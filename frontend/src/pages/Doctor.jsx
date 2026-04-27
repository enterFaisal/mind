import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Search, Stethoscope, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import Dashboard from './Dashboard';

export default function Doctor() {
  const { patientId } = useParams();
  const { authHeaders } = useAuth();
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users/patients`, {
          headers: authHeaders,
        });
        setPatients(response.data);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, [authHeaders]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId),
    [patientId, patients],
  );

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return patients;

    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(normalizedQuery) ||
        patient.id.toLowerCase().includes(normalizedQuery),
    );
  }, [patients, query]);

  if (patientId) {
    return (
      <div className="w-full animate-fade-in">
        <div className="mb-4">
          <Link
            to="/doctor"
            className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to patients
          </Link>
        </div>
        <Dashboard patientId={patientId} patientName={selectedPatient?.name || 'Selected Patient'} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-3 sm:p-6 animate-fade-in">
      <section className="bg-white/90 border border-white/70 shadow-sm rounded-[2rem] p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 mb-3">
              <Stethoscope className="w-4 h-4" />
              Doctor View
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Patients</h1>
            <p className="text-gray-500 mt-1">Select a patient to view their clinical dashboard.</p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or ID"
              className="w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400 font-medium">Loading patients...</div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-12 text-center text-gray-400 font-medium">No patients found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                to={`/doctor/patient/${patient.id}`}
                className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-teal-100 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <UserRound className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-900 truncate">{patient.name}</h2>
                    <p className="font-mono text-xs text-gray-400 mt-1 truncate">{patient.id}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
