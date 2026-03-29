import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProfileViewers() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/analytics', { replace: true }); }, [navigate]);
  return null;
}
