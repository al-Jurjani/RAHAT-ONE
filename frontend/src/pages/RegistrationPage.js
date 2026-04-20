import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { registrationAPI } from '../services/api';

const registrationTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#FF6B35', contrastText: '#ffffff' },
    background: { default: '#f5f7fb', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#4b5563' },
    divider: 'rgba(17,24,39,0.10)',
  },
  typography: {
    fontFamily: "'Mona Sans', system-ui, sans-serif",
    h3: { fontFamily: "'Hubot Sans', system-ui, sans-serif", fontWeight: 700, color: '#111827' },
    h4: { fontFamily: "'Hubot Sans', system-ui, sans-serif", fontWeight: 600, color: '#111827' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: '#ffffff', border: '1px solid rgba(17,24,39,0.10)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: '10px' },
        containedPrimary: { backgroundColor: '#FF6B35', color: '#ffffff', '&:hover': { backgroundColor: '#e05a2c' } },
        outlined: { borderColor: 'rgba(17,24,39,0.20)', color: '#374151' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#ffffff',
            '& fieldset': { borderColor: 'rgba(17,24,39,0.20)' },
            '&:hover fieldset': { borderColor: 'rgba(17,24,39,0.35)' },
            '&.Mui-focused fieldset': { borderColor: '#FF6B35' },
          },
          '& .MuiInputLabel-root': { color: '#4b5563' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#FF6B35' },
          '& .MuiOutlinedInput-input': { color: '#111827' },
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          color: '#9ca3af',
          '&.Mui-active': { color: '#FF6B35', fontWeight: 600 },
          '&.Mui-completed': { color: '#22c55e' },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: { color: '#d1d5db', '&.Mui-active': { color: '#FF6B35' }, '&.Mui-completed': { color: '#22c55e' } },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { color: 'rgba(17,24,39,0.30)', '&.Mui-checked': { color: '#FF6B35' } } },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: '10px' } } },
    MuiFormHelperText: { styleOverrides: { root: { color: '#6b7280' } } },
  },
});

// ─── Formatters ───────────────────────────────────────────────────────────────

const formatCNIC = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

const formatPhone = (raw) => {
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');

  if (hasPlus) {
    // +92-3XX-XXXXXXX  (country 2 + 10 = 12 digits)
    const d = digits.slice(0, 12);
    if (d.length <= 2) return '+' + d;
    if (d.length <= 5) return `+${d.slice(0, 2)}-${d.slice(2)}`;
    return `+${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  }

  // 0XXX-XXXXXXX  (11 digits local)
  const d = digits.slice(0, 11);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
};

// ─── File Upload Field ─────────────────────────────────────────────────────────

function FileUploadField({ label, name, accept, required = false, onChange, file }) {
  return (
    <Box>
      <Typography variant="body2" fontWeight={500} sx={{ color: '#374151', mb: 0.75 }}>
        {label}
        {required && <Box component="span" sx={{ color: '#ef4444', ml: 0.5 }}>*</Box>}
      </Typography>
      <Box
        sx={{
          border: '2px dashed',
          borderColor: file ? '#22c55e' : 'rgba(17,24,39,0.20)',
          borderRadius: 2,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: file ? 'rgba(34,197,94,0.04)' : '#fafafa',
          transition: 'all 0.2s',
          '&:hover': { borderColor: '#FF6B35', bgcolor: 'rgba(255,107,53,0.04)' },
        }}
      >
        <Button component="label" variant="outlined" size="small" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {file ? 'Change File' : 'Choose File'}
          <input type="file" name={name} accept={accept} onChange={onChange} hidden />
        </Button>
        <Typography variant="body2" color={file ? 'success.main' : 'text.secondary'} noWrap sx={{ fontSize: '0.8125rem' }}>
          {file ? file.name : 'No file selected'}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#111827', mb: 2 }}>
      {children}
    </Typography>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const steps = ['Personal Information', 'Additional Details', 'Upload Documents', 'Set Password'];

// ─── Main Component ────────────────────────────────────────────────────────────

function RegistrationPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Force white background regardless of app theme mode
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#f5f7fb';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  const params = new URLSearchParams(window.location.search);
  const employeeType   = params.get('type')       || 'office';
  const employeeToken  = params.get('token')       || '';

  // URLSearchParams can return HTML-entity-encoded strings (e.g. &amp;) when the
  // URL was built inside an HTML anchor tag by n8n. Decode them here.
  const decodeHtml = (str) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };
  const assignedDept   = decodeHtml(params.get('department')  || '');
  const assignedPos    = decodeHtml(params.get('position')    || '');

  const [formData, setFormData] = useState({
    personalEmail: '',
    name: '',
    cnicNumber: '',
    fatherName: '',
    dateOfBirth: '',
    phone: '',
    bankName: '',
    bankAccountNumber: '',
    bankIban: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    password: '',
    confirmPassword: '',
    medicalDeclaration: false,
  });

  const [files, setFiles] = useState({ cnic: null, degree: null, medical: null });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCNICChange = (e) => {
    setFormData(prev => ({ ...prev, cnicNumber: formatCNIC(e.target.value) }));
  };

  const handlePhoneChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: formatPhone(e.target.value) }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    setFiles(prev => ({ ...prev, [name]: fileList[0] }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep1 = () => {
    if (!formData.personalEmail || !formData.name || !formData.cnicNumber ||
        !formData.fatherName || !formData.dateOfBirth || !formData.phone) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (!/^\d{5}-\d{7}-\d{1}$/.test(formData.cnicNumber)) {
      toast.error('CNIC must be in format: 12345-1234567-1');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.emergencyContactName || !formData.emergencyContactPhone) {
      toast.error('Emergency contact name and phone are required');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!files.cnic) {
      toast.error('CNIC document is required');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!formData.password || formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateStep1()) return;
    if (activeStep === 1 && !validateStep2()) return;
    if (activeStep === 2 && !validateStep3()) return;
    if (activeStep === 3 && !validateStep4()) return;
    if (activeStep === steps.length - 1) handleSubmit();
    else setActiveStep(prev => prev + 1);
  };

  const handleBack = () => setActiveStep(prev => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('personalEmail', formData.personalEmail);
      submitData.append('name', formData.name);
      submitData.append('cnicNumber', formData.cnicNumber);
      submitData.append('fatherName', formData.fatherName);
      submitData.append('dateOfBirth', formData.dateOfBirth);
      submitData.append('phone', formData.phone);
      submitData.append('password', formData.password);
      submitData.append('bankName', formData.bankName);
      submitData.append('bankAccountNumber', formData.bankAccountNumber);
      submitData.append('bankIban', formData.bankIban);
      submitData.append('emergencyContactName', formData.emergencyContactName);
      submitData.append('emergencyContactRelationship', formData.emergencyContactRelationship);
      submitData.append('emergencyContactPhone', formData.emergencyContactPhone);
      if (employeeType === 'shop_floor') submitData.append('medicalDeclaration', formData.medicalDeclaration);
      if (employeeToken) submitData.append('employeeToken', employeeToken);
      submitData.append('cnic', files.cnic);
      if (files.degree) submitData.append('degree', files.degree);
      if (files.medical) submitData.append('medical', files.medical);

      await registrationAPI.complete(submitData);
      toast.success('Registration completed! You will receive an email once verified.');
      setActiveStep(steps.length);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ── Step content ────────────────────────────────────────────────────────────

  const renderStepContent = (step) => {
    switch (step) {

      case 0: {
        const workEmailPreview = formData.name
          ? formData.name.toLowerCase().replace(/\s+/g, '.').split('.').slice(0, 2).join('.') + '@outfitters.com'
          : null;

        return (
          <Grid container spacing={3}>

            {/* Assignment info — full width, shows even if only one is present */}
            {(assignedDept || assignedPos) && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                  {assignedDept && (
                    <Box><strong>Department:</strong> {assignedDept}</Box>
                  )}
                  {assignedPos && (
                    <Box><strong>Position:</strong> {assignedPos}</Box>
                  )}
                </Alert>
              </Grid>
            )}

            {/* Left column */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField required fullWidth label="Personal Email" name="personalEmail" type="email"
                  value={formData.personalEmail} onChange={handleInputChange} />
                <TextField required fullWidth label="Full Name" name="name"
                  value={formData.name} onChange={handleInputChange} />
                <TextField required fullWidth label="Father's Name" name="fatherName"
                  value={formData.fatherName} onChange={handleInputChange} />
              </Box>
            </Grid>

            {/* Right column */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  required fullWidth label="CNIC Number" name="cnicNumber"
                  placeholder="12345-1234567-1"
                  value={formData.cnicNumber}
                  onChange={handleCNICChange}
                  helperText="Format: 12345-1234567-1 (13 digits)"
                  inputProps={{ maxLength: 15 }}
                />
                <TextField
                  required fullWidth label="Phone Number" name="phone"
                  placeholder="+92-300-1234567"
                  value={formData.phone}
                  onChange={handlePhoneChange('phone')}
                  helperText="e.g. +92-300-1234567 or 0300-1234567"
                  inputProps={{ maxLength: 16 }}
                />
                <TextField
                  required fullWidth label="Date of Birth" name="dateOfBirth" type="date"
                  value={formData.dateOfBirth} onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Grid>

            {/* Work email preview — full width */}
            {workEmailPreview && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Your work email will be: <strong>{workEmailPreview}</strong>
                </Alert>
              </Grid>
            )}
          </Grid>
        );
      }

      case 1:
        return (
          <Grid container spacing={3}>
            {/* Left: Bank Details */}
            <Grid item xs={12} sm={6}>
              <SectionHeader>Bank Details</SectionHeader>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -1.5 }}>
                For salary disbursement
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField fullWidth label="Bank Name" name="bankName"
                  value={formData.bankName} onChange={handleInputChange}
                  placeholder="e.g. HBL, Meezan Bank, JazzCash" />
                <TextField fullWidth label="Account Number" name="bankAccountNumber"
                  value={formData.bankAccountNumber} onChange={handleInputChange}
                  inputProps={{ maxLength: 20 }} />
                <TextField fullWidth label="IBAN" name="bankIban"
                  value={formData.bankIban} onChange={handleInputChange}
                  placeholder="PK00XXXX0000000000000000"
                  inputProps={{ maxLength: 34 }} />
              </Box>
            </Grid>

            {/* Right: Emergency Contact */}
            <Grid item xs={12} sm={6}>
              <SectionHeader>Emergency Contact</SectionHeader>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, mt: -1.5 }}>
                Reachable in case of emergencies
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField required fullWidth label="Contact Name" name="emergencyContactName"
                  value={formData.emergencyContactName} onChange={handleInputChange} />
                <TextField fullWidth label="Relationship" name="emergencyContactRelationship"
                  value={formData.emergencyContactRelationship} onChange={handleInputChange}
                  placeholder="e.g. Father, Spouse, Sibling" />
                <TextField
                  required fullWidth label="Contact Phone" name="emergencyContactPhone"
                  placeholder="+92-300-1234567"
                  value={formData.emergencyContactPhone}
                  onChange={handlePhoneChange('emergencyContactPhone')}
                  helperText="e.g. +92-300-1234567 or 0300-1234567"
                  inputProps={{ maxLength: 16 }}
                />
              </Box>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FileUploadField label="CNIC Document" name="cnic" accept="image/*"
                required onChange={handleFileChange} file={files.cnic} />
            </Grid>
            {employeeType === 'office' && (
              <Grid item xs={12}>
                <FileUploadField label="Degree Certificate (Optional)" name="degree"
                  accept=".pdf,image/*" onChange={handleFileChange} file={files.degree} />
              </Grid>
            )}
            {employeeType === 'office' ? (
              <Grid item xs={12}>
                <FileUploadField label="Medical Certificate (Optional)" name="medical"
                  accept=".pdf,image/*" onChange={handleFileChange} file={files.medical} />
              </Grid>
            ) : (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox name="medicalDeclaration" checked={formData.medicalDeclaration}
                      onChange={handleInputChange} color="primary" />
                  }
                  label="I declare that I am medically fit to perform the duties of this position"
                />
              </Grid>
            )}
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField required fullWidth label="Password" name="password" type="password"
                value={formData.password} onChange={handleInputChange}
                helperText="Minimum 8 characters" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField required fullWidth label="Confirm Password" name="confirmPassword"
                type="password" value={formData.confirmPassword} onChange={handleInputChange} />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (activeStep === steps.length) {
    return (
      <ThemeProvider theme={registrationTheme}>
        <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
          <Container maxWidth="sm">
            <Paper elevation={0} sx={{ p: 5, borderRadius: 3, textAlign: 'center' }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '50%',
                bgcolor: 'rgba(34,197,94,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 3,
              }}>
                <Typography variant="h4" sx={{ color: '#22c55e', lineHeight: 1 }}>✓</Typography>
              </Box>
              <Typography variant="h4" gutterBottom sx={{ color: '#22c55e' }}>
                Registration Submitted!
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Your registration has been submitted successfully.
              </Typography>
              <Alert severity="info">
                Your documents are now being verified. You will receive an email with your work
                email and next steps once approved.
              </Alert>
            </Paper>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={registrationTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fb', py: 6 }}>
        <Container maxWidth="md">

          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{ color: '#111827', fontWeight: 700 }}
            >
              Employee Registration
            </Typography>
            <Typography variant="body1" sx={{ color: '#4b5563' }}>
              Complete all steps to register for onboarding
            </Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {renderStepContent(activeStep)}

            <Box sx={{
              display: 'flex', justifyContent: 'space-between', mt: 5, pt: 3,
              borderTop: '1px solid rgba(17,24,39,0.08)',
            }}>
              <Button disabled={activeStep === 0} onClick={handleBack}
                variant="outlined" sx={{ minWidth: 100 }}>
                Back
              </Button>
              <Button variant="contained" onClick={handleNext}
                disabled={loading} sx={{ minWidth: 100 }}>
                {loading
                  ? <CircularProgress size={22} sx={{ color: '#ffffff' }} />
                  : activeStep === steps.length - 1 ? 'Submit' : 'Next'}
              </Button>
            </Box>
          </Paper>

        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default RegistrationPage;
