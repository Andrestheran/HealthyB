import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function SettingsScreen() {
  const { profile, signOut, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Emergency contact fields
  const [emergencyContact, setEmergencyContact] = useState<any>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactRelationship, setContactRelationship] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  useEffect(() => {
    loadEmergencyContact();
  }, [user]);

  async function loadEmergencyContact() {
    if (!user || profile?.role !== 'patient') return;

    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('patient_id', user.id)
        .eq('is_primary', true)
        .single();

      if (data) {
        setEmergencyContact(data);
        setContactName(data.full_name);
        setContactRelationship(data.relationship);
        setContactPhone(data.phone);
      }
    } catch (error) {
      console.warn('No emergency contact found:', error);
    }
  }

  async function handleSave() {
    if (!user || !profile) return;

    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setIsEditing(false);
  }

  async function handleSaveContact() {
    if (!user || profile?.role !== 'patient') return;

    if (!contactName.trim() || !contactRelationship.trim() || !contactPhone.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos del contacto de emergencia');
      return;
    }

    setContactLoading(true);
    try {
      if (emergencyContact) {
        // Update existing contact
        const { error } = await supabase
          .from('emergency_contacts')
          .update({
            full_name: contactName.trim(),
            relationship: contactRelationship.trim(),
            phone: contactPhone.trim(),
          })
          .eq('id', emergencyContact.id);

        if (error) throw error;
      } else {
        // Create new contact
        const { error } = await supabase
          .from('emergency_contacts')
          .insert({
            patient_id: user.id,
            full_name: contactName.trim(),
            relationship: contactRelationship.trim(),
            phone: contactPhone.trim(),
            is_primary: true,
          });

        if (error) throw error;
      }

      Alert.alert('Éxito', 'Contacto de emergencia actualizado correctamente');
      setIsEditingContact(false);
      await loadEmergencyContact();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al actualizar contacto');
    } finally {
      setContactLoading(false);
    }
  }

  function handleCancelContact() {
    if (emergencyContact) {
      setContactName(emergencyContact.full_name);
      setContactRelationship(emergencyContact.relationship);
      setContactPhone(emergencyContact.phone);
    } else {
      setContactName('');
      setContactRelationship('');
      setContactPhone('');
    }
    setIsEditingContact(false);
  }

  function handleDeleteContact() {
    if (!emergencyContact) return;

    Alert.alert(
      'Eliminar Contacto',
      '¿Estás seguro de que deseas eliminar este contacto de emergencia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setContactLoading(true);
            try {
              const { error } = await supabase
                .from('emergency_contacts')
                .delete()
                .eq('id', emergencyContact.id);

              if (error) throw error;

              Alert.alert('Éxito', 'Contacto de emergencia eliminado');
              setEmergencyContact(null);
              setContactName('');
              setContactRelationship('');
              setContactPhone('');
              setIsEditingContact(false);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al eliminar contacto');
            } finally {
              setContactLoading(false);
            }
          },
        },
      ]
    );
  }

  function handleSignOut() {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Error al cerrar sesión');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            {!isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="pencil" size={20} color="#0EA5E9" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nombre completo</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nombre completo"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.full_name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Teléfono</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+57300123456"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.phone}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Rol</Text>
            <Text style={styles.fieldValue}>{profile?.role}</Text>
          </View>

          {isEditing && (
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Emergency Contact Section - Only for patients */}
        {profile?.role === 'patient' && (
          <View style={styles.profileCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Contacto de Emergencia</Text>
              {!isEditingContact && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditingContact(true)}
                >
                  <Ionicons name="pencil" size={20} color="#0EA5E9" />
                </TouchableOpacity>
              )}
            </View>

            {emergencyContact || isEditingContact ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nombre completo</Text>
                  {isEditingContact ? (
                    <TextInput
                      style={styles.input}
                      value={contactName}
                      onChangeText={setContactName}
                      placeholder="Nombre del contacto"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{emergencyContact?.full_name}</Text>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Relación</Text>
                  {isEditingContact ? (
                    <TextInput
                      style={styles.input}
                      value={contactRelationship}
                      onChangeText={setContactRelationship}
                      placeholder="Esposa, Hijo, Hermana, etc."
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{emergencyContact?.relationship}</Text>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Teléfono</Text>
                  {isEditingContact ? (
                    <TextInput
                      style={styles.input}
                      value={contactPhone}
                      onChangeText={setContactPhone}
                      placeholder="+57300123456"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={styles.fieldValue}>{emergencyContact?.phone}</Text>
                  )}
                </View>

                {isEditingContact && (
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={handleCancelContact}
                      disabled={contactLoading}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.saveButton, contactLoading && styles.buttonDisabled]}
                      onPress={handleSaveContact}
                      disabled={contactLoading}
                    >
                      {contactLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {emergencyContact && !isEditingContact && (
                  <TouchableOpacity
                    style={styles.deleteContactButton}
                    onPress={handleDeleteContact}
                    disabled={contactLoading}
                  >
                    <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                    <Text style={styles.deleteContactText}>Eliminar contacto</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContact}>
                <Ionicons name="person-add-outline" size={48} color="#ccc" />
                <Text style={styles.emptyContactText}>No has configurado un contacto de emergencia</Text>
                <TouchableOpacity
                  style={styles.addContactButton}
                  onPress={() => setIsEditingContact(true)}
                >
                  <Text style={styles.addContactButtonText}>Agregar Contacto</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={isEditing}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" style={styles.signOutIcon} />
          <Text style={styles.signOutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Alert-IO MVP v1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontWeight: '500',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#0EA5E9',
    elevation: 2,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  deleteContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteContactText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContact: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyContactText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  addContactButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addContactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#DC2626',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  versionContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
