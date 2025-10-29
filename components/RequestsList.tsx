import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import RequestItem from './RequestItem';

interface Request {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

interface RequestsListProps {
  requests: Request[];
  isOutgoing?: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRequestPress?: (request: Request) => void;
}

export default function RequestsList({ requests, isOutgoing = false, onAccept, onDecline, onRequestPress }: RequestsListProps) {
  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          {isOutgoing ? 'Нет исходящих запросов' : 'Нет входящих запросов'}
        </Text>
        <Text style={styles.emptySubtext}>
          {isOutgoing 
            ? 'Здесь будут отображаться ваши запросы' 
            : 'Здесь будут отображаться входящие запросы'
          }
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.listContainer}>
        {requests.map((request) => (
          <RequestItem
            key={request.id}
            id={request.id}
            type={request.type}
            eventId={request.eventId}
            userId={request.userId}
            isOutgoing={isOutgoing}
            status={request.status}
            onAccept={onAccept}
            onDecline={onDecline}
            onPress={() => onRequestPress?.(request)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingTop: 8,
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

