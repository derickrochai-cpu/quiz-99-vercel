// Buscar cupom do jogador
const { supabase, isSupabaseEnabled } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isSupabaseEnabled || !supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { playerEmail, gameCode } = req.query;

  if (!playerEmail || !gameCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('player_email', playerEmail)
      .eq('game_code', gameCode)
      .single();

    if (error || !coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        description: coupon.description,
        validUntil: coupon.valid_until,
        assignedAt: coupon.assigned_at
      }
    });

  } catch (error) {
    console.error('Error getting coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coupon'
    });
  }
};
