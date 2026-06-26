import { TaskRoadmap } from '@/task/task_roadmap/components/TaskRoadmap';
import { useLocalSearchParams } from 'expo-router';

export default function Index() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
  return <TaskRoadmap id={id} />;
}
