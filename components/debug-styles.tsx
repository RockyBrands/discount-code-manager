'use client'

export function DebugStyles() {
  return (
    <div className="p-8 bg-red-500 text-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-4">Tailwind CSS Test</h2>
      <div className="space-y-2">
        <div className="bg-blue-500 p-4 rounded">Blue Box</div>
        <div className="bg-green-500 p-4 rounded">Green Box</div>
        <div className="bg-yellow-500 p-4 rounded text-black">Yellow Box</div>
      </div>
      <button className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
        Test Button
      </button>
    </div>
  )
}
