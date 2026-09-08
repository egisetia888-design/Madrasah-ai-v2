import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PublishingSettings {
  webhookUrl: string;
  webhookSecret: string;
  serviceName: string;
}

interface PublishingState extends PublishingSettings {
  setPublishingSettings: (settings: Partial<PublishingSettings>) => void;
  clearPublishingSettings: () => void;
}

export const usePublishingStore = create<PublishingState>()(
  persist(
    (set) => ({
      webhookUrl: '',
      webhookSecret: '',
      serviceName: '',
      setPublishingSettings: (settings) =>
        set((state) => ({
          ...state,
          ...settings,
        })),
      clearPublishingSettings: () =>
        set({
          webhookUrl: '',
          webhookSecret: '',
          serviceName: '',
        }),
    }),
    {
      name: 'madrasah_publishing_settings',
    }
  )
);
