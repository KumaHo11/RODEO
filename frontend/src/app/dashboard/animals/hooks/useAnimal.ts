import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

export function useAnimal(id: string) {
  const [animal, setAnimal] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  const fetchAnimalAndEvents = useCallback(async () => {
    if (!user || !id) return
    setLoading(true)
    setError(null)
    try {
      const token = await user.getIdToken()
      
      const [animalRes, eventsRes] = await Promise.all([
        fetch(`/api/animals/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/animals/${id}/events`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      
      if (!animalRes.ok) throw new Error('Failed to fetch animal')
      if (!eventsRes.ok) throw new Error('Failed to fetch events')
      
      const animalData = await animalRes.json()
      const eventsData = await eventsRes.json()
      
      setAnimal(animalData.animal)
      setEvents(eventsData.events || [])
    } catch (err: any) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user, id])

  useEffect(() => {
    fetchAnimalAndEvents()
  }, [fetchAnimalAndEvents])

  const addEvent = async (eventData: any) => {
    if (!user || !id) return
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/animals/${id}/events`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      })
      
      if (!res.ok) throw new Error('Failed to add event')
      
      const data = await res.json()
      if (data.event) {
        setEvents(prev => [data.event, ...prev])
      }
      return data.event
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  return {
    animal,
    events,
    loading,
    error,
    addEvent,
    refetch: fetchAnimalAndEvents
  }
}
