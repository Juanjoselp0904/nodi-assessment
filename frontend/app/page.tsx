import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white mb-3">Nodi</h1>
        <p className="text-gray-400 text-lg max-w-md">
          Plataforma de entrevistas adaptativas por voz para candidatos tech.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/candidate/intake"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          Soy candidato
        </Link>
        <Link
          href="/recruiter"
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          Soy reclutador
        </Link>
      </div>
    </main>
  );
}
