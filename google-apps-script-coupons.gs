/**
 * ============================================
 * QUIZ 99 - COUPON SYSTEM
 * ============================================
 * Gerencia cupons para o Quiz no Vercel
 */

const CONFIG = {
  SHEET_ID: '1tUEuMe1eA3ZTlB9kq61Md0yCI4q41BZLCAigYRK_-3A',
  SHEET_NAME_CUPONS: '🎟️ Cupons Quiz',
  SHEET_NAME_PARTICIPANTES: '📊 Participantes Quiz',
  CUPOM_VALIDADE_DIAS: 30
};

// ============================================
// FUNÇÃO PRINCIPAL - POST
// ============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch(action) {
      case 'getCoupon':
        return getAvailableCoupon(data);
      case 'assignCoupon':
        return assignCouponToPlayer(data);
      case 'validateCoupon':
        return validateCoupon(data);
      case 'getPlayerCoupon':
        return getPlayerCoupon(data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// FUNÇÃO GET - Para testes
// ============================================
function doGet(e) {
  const action = e.parameter.action || 'status';

  if (action === 'status') {
    return jsonResponse({
      status: '✅ Quiz 99 Coupon System Online',
      timestamp: new Date(),
      endpoints: ['getCoupon', 'assignCoupon', 'validateCoupon', 'getPlayerCoupon']
    });
  }

  return jsonResponse({ success: false, error: 'Unknown action' });
}

// ============================================
// OBTER CUPOM DISPONÍVEL
// ============================================
function getAvailableCoupon(data) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_CUPONS);

    if (!sheet) {
      return jsonResponse({
        success: false,
        error: 'No coupons available. Please add coupons to the sheet.'
      });
    }

    // Buscar cupom disponível
    const dataRange = sheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      const status = dataRange[i][7]; // Coluna H - Status
      const email = dataRange[i][2];  // Coluna C - Email

      if ((status === 'Disponível' || status === '' || status === 'Available') &&
          (email === '' || email === undefined)) {

        const coupon = {
          code: dataRange[i][1],      // Coluna B - Código
          discount: dataRange[i][4],  // Coluna E - Desconto
          description: dataRange[i][5] // Coluna F - Descrição
        };

        return jsonResponse({
          success: true,
          coupon: coupon
        });
      }
    }

    return jsonResponse({
      success: false,
      error: 'No coupons available. Please add more coupons.'
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// ATRIBUIR CUPOM AO JOGADOR
// ============================================
function assignCouponToPlayer(data) {
  try {
    const { playerEmail, playerName, gameCode, position } = data;

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_CUPONS);

    if (!sheet) {
      return jsonResponse({ success: false, error: 'Coupon sheet not found' });
    }

    // Buscar cupom disponível
    const dataRange = sheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      const status = dataRange[i][7];
      const email = dataRange[i][2];

      if ((status === 'Disponível' || status === '' || status === 'Available') &&
          (email === '' || email === undefined)) {

        // Calcular validade
        const validade = new Date();
        validade.setDate(validade.getDate() + CONFIG.CUPOM_VALIDADE_DIAS);

        // Atualizar cupom
        sheet.getRange(i + 1, 3).setValue(playerEmail);  // C - Email
        sheet.getRange(i + 1, 4).setValue(playerName);   // D - Nome
        sheet.getRange(i + 1, 7).setValue(position);   // G - Posição
        sheet.getRange(i + 1, 8).setValue('Atribuído'); // H - Status
        sheet.getRange(i + 1, 9).setValue(validade);    // I - Validade
        sheet.getRange(i + 1, 10).setValue(gameCode);   // J - Game Code
        sheet.getRange(i + 1, 11).setValue(new Date()); // K - Data Atribuição

        // Salvar participante
        saveParticipant(data);

        return jsonResponse({
          success: true,
          coupon: {
            code: dataRange[i][1],
            discount: dataRange[i][4],
            description: dataRange[i][5],
            validUntil: validade
          },
          message: 'Coupon assigned successfully!'
        });
      }
    }

    return jsonResponse({ success: false, error: 'No coupons available' });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// SALVAR PARTICIPANTE
// ============================================
function saveParticipant(data) {
  try {
    const { playerEmail, playerName, gameCode, position, score } = data;

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_PARTICIPANTES);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME_PARTICIPANTES);
      sheet.appendRow(['📅 Data', '📧 Email', '👤 Nome', '🏆 Posição', '⭐ Pontuação', '🔑 Game Code']);
    }

    sheet.appendRow([
      new Date(),
      playerEmail,
      playerName,
      position,
      score || 0,
      gameCode
    ]);

  } catch (error) {
    Logger.log('Error saving participant: ' + error.toString());
  }
}

// ============================================
// OBTER CUPOM DO JOGADOR
// ============================================
function getPlayerCoupon(data) {
  try {
    const { playerEmail, gameCode } = data;

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_CUPONS);

    if (!sheet) {
      return jsonResponse({ success: false, error: 'No coupons found' });
    }

    const dataRange = sheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][2] === playerEmail && dataRange[i][9] === gameCode) {
        return jsonResponse({
          success: true,
          coupon: {
            code: dataRange[i][1],
            discount: dataRange[i][4],
            description: dataRange[i][5],
            validUntil: dataRange[i][8]
          }
        });
      }
    }

    return jsonResponse({ success: false, error: 'No coupon found for this player' });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// VALIDAR CUPOM
// ============================================
function validateCoupon(data) {
  try {
    const { couponCode } = data;

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_CUPONS);

    if (!sheet) {
      return jsonResponse({ success: false, error: 'Coupon not found' });
    }

    const dataRange = sheet.getDataRange().getValues();
    for (let i = 1; i < dataRange.length; i++) {
      if (dataRange[i][1] === couponCode) {
        const status = dataRange[i][7];
        const validade = new Date(dataRange[i][8]);

        if (status === 'Usado' || status === 'Used') {
          return jsonResponse({ success: false, error: 'Coupon already used' });
        }

        if (new Date() > validade) {
          return jsonResponse({ success: false, error: 'Coupon expired' });
        }

        return jsonResponse({
          success: true,
          coupon: {
            code: dataRange[i][1],
            discount: dataRange[i][4],
            description: dataRange[i][5]
          }
        });
      }
    }

    return jsonResponse({ success: false, error: 'Coupon not found' });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// FUNÇÃO PARA INICIALIZAR PLANILHA
// ============================================
function inicializarPlanilha() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);

    // Criar aba de cupons
    let cuponsSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_CUPONS);
    if (!cuponsSheet) {
      cuponsSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME_CUPONS);
      cuponsSheet.appendRow([
        '📅 Data',
        '🎟️ Código',
        '📧 Email',
        '👤 Nome',
        '💰 Desconto',
        '📝 Descrição',
        '🏆 Posição',
        'Status',
        '📆 Validade',
        '🔑 Game',
        '📅 Data Atribuição'
      ]);

      // Adicionar cupons de exemplo
      const cuponsExemplo = [
        ['Q99WIN20', 'R$ 20,00 OFF', '20% discount on your next ride', 'Available'],
        ['Q99WIN15', 'R$ 15,00 OFF', '15% discount on your next ride', 'Available'],
        ['Q99WIN10', 'R$ 10,00 OFF', '10% discount on your next ride', 'Available'],
        ['Q99PARTICIP', 'R$ 5,00 OFF', 'Thanks for participating!', 'Available']
      ];

      cuponsExemplo.forEach(c => {
        cuponsSheet.appendRow([new Date(), c[0], '', '', c[1], c[2], '', c[3], '', '', '']);
      });

      Logger.log('✅ Aba de cupons criada com exemplos');
    }

    // Criar aba de participantes
    let participantesSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME_PARTICIPANTES);
    if (!participantesSheet) {
      participantesSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME_PARTICIPANTES);
      participantesSheet.appendRow(['📅 Data', '📧 Email', '👤 Nome', '🏆 Posição', '⭐ Pontuação', '🔑 Game Code']);
      Logger.log('✅ Aba de participantes criada');
    }

    return jsonResponse({
      success: true,
      message: 'Planilha inicializada com sucesso!'
    });

  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// UTILITÁRIOS
// ============================================
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
