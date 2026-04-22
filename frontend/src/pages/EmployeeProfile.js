import React, { useEffect, useMemo, useState } from 'react';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { toast } from 'react-toastify';
import AppShell from '../components/layout/AppShell';
import { Avatar, Button, Card, FormField, LoadingSpinner } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { employeeAPI } from '../services/api';

function EmployeeProfile() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [formValues, setFormValues] = useState({
    mobile_phone: '',
    private_email: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!employeeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await employeeAPI.getProfile(employeeId);
        const data = response.data?.data;
        setProfile(data);
        setFormValues({
          mobile_phone: data?.personalPhone || '',
          private_email: data?.personalEmail || '',
          emergency_contact_name: data?.emergencyContactName || '',
          emergency_contact_phone: data?.emergencyContactPhone || ''
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast.error('Failed to load employee profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [employeeId]);

  const avatarSrc = useMemo(() => {
    if (!profile) return '';
    return profile.photoDataUri || profile.photoUrl || '';
  }, [profile]);

  const lockedRows = [
    { label: 'Job Title',   value: profile?.jobTitle || '-' },
    { label: 'Department',  value: profile?.department?.name || '-' },
    { label: 'Manager',     value: profile?.manager?.name || '-' },
    { label: 'Branch',      value: profile?.branch?.name || '-' },
    { label: 'Shift',       value: profile?.shift?.name || '-' },
    { label: 'Work Email',  value: profile?.workEmail || '-' },
    { label: 'Employee ID', value: profile?.employeeId || '-' },
    { label: 'Join Date',   value: profile?.joinDate ? new Date(profile.joinDate).toLocaleDateString() : '-' }
  ];

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    setPhotoFile(file);
  };

  const handleSave = async () => {
    if (!employeeId) return;

    setSaving(true);
    try {
      await employeeAPI.updateProfile(employeeId, {
        mobile_phone: formValues.mobile_phone,
        private_email: formValues.private_email,
        emergency_contact_name: formValues.emergency_contact_name,
        emergency_contact_phone: formValues.emergency_contact_phone
      });

      if (photoFile) {
        const data = new FormData();
        data.append('photo', photoFile);
        const photoResponse = await employeeAPI.uploadProfilePhoto(employeeId, data);
        const newPhotoUrl = photoResponse.data?.data?.photoUrl;
        if (newPhotoUrl) {
          setProfile((prev) => ({ ...prev, photoUrl: newPhotoUrl, photoDataUri: null }));
        }
        setPhotoFile(null);
      }

      const refreshed = await employeeAPI.getProfile(employeeId);
      const refreshedProfile = refreshed.data?.data;
      setProfile(refreshedProfile);
      setFormValues({
        mobile_phone: refreshedProfile?.personalPhone || '',
        private_email: refreshedProfile?.personalEmail || '',
        emergency_contact_name: refreshedProfile?.emergencyContactName || '',
        emergency_contact_phone: refreshedProfile?.emergencyContactPhone || ''
      });

      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error(error.response?.data?.message || 'Failed to save profile updates');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell pageTitle="Employee Profile">
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Employee Profile">
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>

        {/* Header card: avatar + name/title/dept + photo upload on the right */}
        <Card>
          <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name={profile?.name || ''} src={avatarSrc} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                {profile?.name || 'Employee'}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {profile?.jobTitle || 'No title'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                {profile?.department?.name || 'No department'}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Profile Photo
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  color: editing ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  cursor: editing ? 'pointer' : 'not-allowed'
                }}
              >
                <UploadFileOutlinedIcon fontSize="small" />
                <span style={{ fontSize: 'var(--text-sm)' }}>{photoFile ? photoFile.name : 'Choose image'}</span>
                <input type="file" hidden disabled={!editing} accept="image/*" onChange={handlePhotoChange} />
              </label>
            </div>
          </div>
        </Card>

        {/* Editable details: 2-column grid, no orphaned rows */}
        <Card
          header="Editable Details"
          headerRight={(
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {!editing ? (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <EditOutlinedIcon fontSize="small" style={{ marginRight: 'var(--space-1)' }} />
                  Edit
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                  <SaveOutlinedIcon fontSize="small" style={{ marginRight: 'var(--space-1)' }} />
                  Save Changes
                </Button>
              )}
            </div>
          )}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', alignItems: 'end' }}>
            <FormField
              label="Personal Phone Number"
              name="mobile_phone"
              value={formValues.mobile_phone}
              onChange={handleFieldChange}
              disabled={!editing}
              placeholder="Enter personal phone"
            />
            <FormField
              label="Personal Email"
              name="private_email"
              type="email"
              value={formValues.private_email}
              onChange={handleFieldChange}
              disabled={!editing}
              placeholder="Enter personal email"
            />
            <FormField
              label="Emergency Contact Name"
              name="emergency_contact_name"
              value={formValues.emergency_contact_name}
              onChange={handleFieldChange}
              disabled={!editing}
              placeholder="Enter emergency contact name"
            />
            <FormField
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              value={formValues.emergency_contact_phone}
              onChange={handleFieldChange}
              disabled={!editing}
              placeholder="Enter emergency contact phone"
            />
          </div>
        </Card>

        {/* Locked details */}
        <Card header="Locked Details">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            {lockedRows.map((row) => (
              <div key={row.label}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 'var(--space-1)'
                  }}
                >
                  {row.label}
                  <span title="Contact HR to update" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <LockOutlinedIcon fontSize="inherit" />
                  </span>
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export default EmployeeProfile;
