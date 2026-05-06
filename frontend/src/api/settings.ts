import client from './client';

export interface SidebarItem {
  to: string;
  label: string;
}

export const settingsApi = {
  getSidebar: () => client.get<SidebarItem[]>('/settings/sidebar'),
  updateSidebar: (config: SidebarItem[]) => client.put('/settings/sidebar', config),
};
