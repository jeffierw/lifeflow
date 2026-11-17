import { create } from 'zustand'

const sopStore = create((set) => ({
  currentSop: null,
  sops: [],
  stepIndex: 0,
  isExecuting: false,
  timer: null,
  timerSeconds: 0,
  
  setCurrentSop: (sop) => set({ currentSop: sop, stepIndex: 0, isExecuting: false }),
  
  setStepIndex: (index) => set({ stepIndex: index }),
  
  nextStep: () => set((state) => ({
    stepIndex: Math.min(state.stepIndex + 1, (state.currentSop?.steps?.length || 0) - 1),
  })),
  
  prevStep: () => set((state) => ({
    stepIndex: Math.max(state.stepIndex - 1, 0),
  })),
  
  startExecution: () => set({ isExecuting: true }),
  
  stopExecution: () => set({ isExecuting: false }),
  
  incrementTimer: () => set((state) => ({ timerSeconds: state.timerSeconds + 1 })),
  
  updateStep: (stepIndex, updates) => set((state) => {
    if (!state.currentSop?.steps) return state
    const newSteps = [...state.currentSop.steps]
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates }
    return { currentSop: { ...state.currentSop, steps: newSteps } }
  }),
  
  addStep: (step) => set((state) => ({
    currentSop: {
      ...state.currentSop,
      steps: [...(state.currentSop?.steps || []), step],
    },
  })),
  
  removeStep: (stepIndex) => set((state) => ({
    currentSop: {
      ...state.currentSop,
      steps: state.currentSop?.steps?.filter((_, i) => i !== stepIndex) || [],
    },
  })),
  
  reorderSteps: (fromIndex, toIndex) => set((state) => {
    if (!state.currentSop?.steps) return state
    const newSteps = [...state.currentSop.steps]
    const [removed] = newSteps.splice(fromIndex, 1)
    newSteps.splice(toIndex, 0, removed)
    return { currentSop: { ...state.currentSop, steps: newSteps } }
  }),
  
  addSop: (sop) => set((state) => ({ sops: [sop, ...state.sops] })),
  
  updateSops: (sops) => set({ sops }),
}))

export default sopStore
