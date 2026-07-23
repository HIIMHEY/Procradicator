import { AnalyticsPage } from '@/analytics/components/AnalyticsPage';
import { useRouter } from 'expo-router';

export default function AnalyticsRoute() {
  const router = useRouter();
  return <AnalyticsPage onMenuPress={() => router.replace('/tasks')} />;
}
