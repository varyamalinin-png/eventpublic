import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import RequestMiniCard from './RequestMiniCard';

interface RequestCardProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress?: () => void;
}

interface RequestsGridProps {
  requests: Array<{
    id: string;
    type: 'event' | 'friend';
    eventId?: string;
    userId?: string;
  }>;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onRequestPress?: (request: { id: string; type: 'event' | 'friend'; eventId?: string; userId?: string }) => void;
}

export default function RequestsGrid({ requests, onAccept, onDecline, onRequestPress }: RequestsGridProps) {
  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Нет новых запросов</Text>
        <Text style={styles.emptySubtext}>Здесь будут отображаться входящие запросы</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {requests.map((request, index) => (
          <View key={request.id} style={styles.gridItem}>
            <RequestMiniCard
              id={request.id}
              type={request.type}
              eventId={request.eventId}
              userId={request.userId}
              onAccept={onAccept}
              onDecline={onDecline}
              onPress={() => onRequestPress?.(request)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
