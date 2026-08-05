// Atribuir cupom ao jogador
const { supabase, isSupabaseEnabled } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isSupabaseEnabled || !supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { playerEmail, playerName, gameCode, position, score } = req.body;

  if (!playerEmail || !playerName || !gameCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Salvar participante
    await supabase.from('participants').insert({
      player_email: playerEmail,
      player_name: playerName,
      game_code: gameCode,
      position: position,
      score: score || 0
    });

    // 2. Verificar se jogador já tem cupom para este jogo
    const { data: existingCoupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('player_email', playerEmail)
      .eq('game_code', gameCode)
      .single();

    if (existingCoupon) {
      return res.json({
        success: true,
        coupon: {
          code: existingCoupon.code,
          discount: existingCoupon.discount,
          description: existingCoupon.description,
          validUntil: existingCoupon.valid_until
        },
        message: 'Coupon already assigned'
      });
    }

    // 3. Buscar cupom disponível
    const { data: availableCoupon, error: findError } = await supabase
      .from('coupons')
      .select('*')
      .eq('status', 'available')
      .is('player_email', null)
      .limit(1)
      .single();

    if (findError || !availableCoupon) {
      return res.status(404).json({
        success: false,
        error: 'No coupons available'
      });
    }

    // 4. Atribuir cupom ao jogador
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const { error: updateError } = await supabase
      .from('coupons')
      .update({
        status: 'assigned',
        player_email: playerEmail,
        player_name: playerName,
        game_code: gameCode,
        position: position,
        assigned_at: new Date().toISOString(),
        valid_until: validUntil.toISOString()
      })
      .eq('id', availableCoupon.id);

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      coupon: {
        code: availableCoupon.code,
        discount: availableCoupon.discount,
        description: availableCoupon.description,
        validUntil: validUntil.toISOString()
      },
      message: 'Coupon assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign coupon'
    });
  }
};
