const {
  Usuario,
  Endereco,
  Genero,
  Motorista,
  Chefe,
  Documento,
  Viagem,
  Status,
  CidadeConsul,
  Solicitacao,
  Acompanhante,
  Participante,
  Veiculo,
  
} = require("../models");
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");
const bcrypt = require("bcrypt");

exports.renderPerfil = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;

    const motorista = await Motorista.findOne({
      where: { cod: codMotorista },
      include: [
        { model: Endereco },
        { model: Genero },
        { model: Documento }
      ],
    });

    res.render('motorista/perfil/index', {
      motorista,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'perfil',
      userType: 'motorista'
    });
  } catch (err) {
    console.error("Erro ao carregar perfil:", err);
    res.status(500).send("Erro no servidor");
  }
};

exports.renderMudarSenha = async (req, res) => {
     const codMotorista = req.session.motorista.cod;

    const motorista = await Motorista.findOne({
      where: { cod: codMotorista }
    });

   res.render('motorista/perfil/senha', {
      motorista,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'perfil',
      userType: 'motorista',
      erroSenha: null
    });
};

exports.atualizarSenha = async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const cod = req.session.motorista.cod;

    const motorista = await Motorista.findByPk(cod);

    if (!motorista) {
      return res.render('motorista/perfil/senha', {
        layout: 'layouts/layoutMotorista',
        paginaAtual: 'perfil',
        userType: 'motorista',
        erroSenha: 'Usuário não encontrado.'
      });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, motorista.senha);
    if (!senhaCorreta) {
      return res.render('motorista/perfil/senha', {
        layout: 'layouts/layoutMotorista',
        paginaAtual: 'perfil',
        userType: 'motorista',
        erroSenha: 'Senha atual inválida, verifique e tente novamente.'
      });
    }

    const senhaValida =
      senhaNova.length >= 8 &&
      /\d/.test(senhaNova) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(senhaNova) &&
      /[A-Z]/.test(senhaNova) &&
      /[a-z]/.test(senhaNova);

    if (!senhaValida) {
      return res.render('motorista/perfil/senha', {
        layout: 'layouts/layoutMotorista',
        paginaAtual: 'perfil',
        userType: 'motorista',
        erroSenha:
          'Nova senha inválida, verifique e tente novamente.'
      });
    }

    const hashNovaSenha = await bcrypt.hash(senhaNova, 10);
    await Motorista.update(
      { senha: hashNovaSenha },
      { where: { cod } }
    );

    
    res.redirect('/motorista/perfil');

  } catch (error) {
    console.error(error);
    return res.render('motorista/perfil/senha', {
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'perfil',
      userType: 'motorista',
      erroSenha: 'Ocorreu um erro ao atualizar a senha. Tente novamente.'
    });
  }
};

exports.renderUsuarios = async (req, res) => {
  try {
    if (!req.session.motorista) {
      return res.status(403).send('Acesso negado. Faça login como motorista.');
    }

    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const termo = req.query.q ? req.query.q.trim() : '';

    const whereCondition = termo
      ? {
          [Op.or]: [
            { nome: { [Op.like]: `%${termo}%` } },
            { CPF: { [Op.like]: `%${termo}%` } },
          ],
        }
      : {};

    const { count, rows } = await Usuario.findAndCountAll({
      where: whereCondition,
      include: [{ model: Endereco }, { model: Genero }],
      order: [['cod', 'DESC']],
      limit,
      offset,
    });

    const totalPaginas = Math.ceil(count / limit);

    res.render('motorista/usuarios/index', {
      motorista,
      usuarios: rows,
      totalPaginas,
      paginaNun: page,
      termoPesquisa: termo,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'usuarios',
      userType: 'motorista'
    });

  } catch (erro) {
    console.error('Erro ao buscar usuários:', erro);
    res.status(500).send('Erro ao buscar usuários: ' + erro.message);
  }
};

exports.renderViagens = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const viagens = await Viagem.findAll({
      include: [
        { model: CidadeConsul, as: 'cidadeconsul' },
        { model: Veiculo, as: 'veiculo' },
        { model: Status },
        { model: Motorista, as: 'Motorista' }
      ],
      order: [['data_viagem', 'DESC']]
    });

    res.render('motorista/viagens/index', {
      motorista,
      viagens,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'viagens',
      userType: 'motorista'
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao carregar calendário de viagens do motorista');
  }
};

exports.renderViagensLista = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const cidade = req.query.cidade ? req.query.cidade.trim() : '';
    const data = req.query.data || '';
    const minhasViagens = req.query.minhas === '1';

    // monta o filtro
    let where = { statusID: [1, 2, 3] };

    if (data) {
      where.data_viagem = { [Op.between]: [data + ' 00:00:00', data + ' 23:59:59'] };
    } else {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      where.data_viagem = { [Op.gte]: hoje };
    }

    if (minhasViagens) {
      where.motoristaID = codMotorista;
    }

    const includeCidade = {
      model: CidadeConsul,
      as: 'cidadeconsul',
      ...(cidade && { where: { descricao: { [Op.like]: `%${cidade}%` } } })
    };

    const { count, rows } = await Viagem.findAndCountAll({
      where,
      include: [
        includeCidade,
        { model: Veiculo, as: 'veiculo' },
        { model: Status, as: 'status' },
        { model: Motorista, as: 'Motorista' },
        { model: Participante, as: 'participantes' }
      ],
      order: [['data_viagem', 'ASC'], ['horario_saida', 'ASC']],
      limit,
      offset,
      distinct: true
    });

    const viagensComOcupacao = rows.map(v => {
      const qtdParticipantes = v.participantes.length;
      const qtdAcompanhantes = v.participantes.reduce(
        (soma, p) => soma + (p.acompanhanteID ? 1 : 0),
        0
      );
      return { ...v.toJSON(), ocupacao: qtdParticipantes + qtdAcompanhantes };
    });

     const viagensComCores = viagensComOcupacao.map(v => {
      let corFundo, corCabeca;
      switch (v.statusID) {
        case 1: corFundo = '#d1e3fd'; corCabeca = '#a7c9f9'; break;
        case 2: corFundo = '#c38883'; corCabeca = '#ac6a64'; break;
        case 3: corFundo = '#bcde9e'; corCabeca = '#a1d49f'; break;
        default: corFundo = '#d1e3fd'; corCabeca = '#a7c9f9';
      }
      return { ...v, corFundo, corCabeca };
    });

    const totalPaginas = Math.max(1, Math.ceil(count / limit));

    res.render('motorista/viagens/lista', {
      motorista,
      viagens: viagensComCores,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'viagens',
      totalPaginas,
      paginaNun: page,
      termoCidade: cidade,
      termoData: data,
      minhasViagens
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao carregar lista de viagens do motorista');
  }
};

exports.renderBuscarEventos = async (req, res) => {
  try {
    const viagens = await Viagem.findAll({
      include: [{ model: CidadeConsul, as: 'cidadeconsul' }]
    });

   const eventos = viagens.map((v) => {
 
    let corFundo = '#a2c3f2';
    let corBorda = '#87afe6';
    let corTexto = '#fff';

    switch (v.statusID) {
      case 1: // AGENDADA
        corFundo = '#a2c3f2'; 
        corBorda = '#87afe6';
        corTexto = '#fff';
        break;
      case 2: // "CANCELADA"
        corFundo = '#c38883ff'; 
        corBorda = '#ac6a64ff';
        corTexto = '#fff';
        break;
      case 3: // "CONCLUIDA"
        corFundo = '#bcde9eff'; 
        corBorda = '#a1d49fff';
        corTexto = '#fff';
        break;
    }

    return {
      title: v.cidadeconsul.descricao,
      start: v.data_viagem,
      url: `/motorista/viagens/ver-viagem/${v.cod}`,
      backgroundColor: corFundo,
      borderColor: corBorda,
      textColor: corTexto,
    };
  });

  res.json(eventos);

  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao carregar eventos do calendário');
  }
};

exports.renderVerViagem = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const cod = req.params.cod;
    const viagem = await Viagem.findOne({
      where: { cod },
      include: [
        { model: Motorista, as: 'Motorista' },
        { model: Status },
        { model: CidadeConsul, as: 'cidadeconsul' },
        { model: Veiculo, as: 'veiculo' }
      ]
    });

    if (!viagem) return res.status(404).send('Viagem não encontrada');

    res.render('motorista/viagens/ver-viagem', {
      motorista,
      viagem,
      layout: 'layouts/layoutMotorista',
      paginaAtual: 'viagens',
      userType: 'motorista'
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao carregar viagem');
  }
};

exports.verParticipantes = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const cod = req.params.cod;

    // ----- PAGINAÇÃO -----
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    // ----- PESQUISA -----
    const termo = req.query.q ? req.query.q.trim() : "";
    const whereCondition = termo
      ? {
          viagemId: cod,
          [Sequelize.Op.or]: [
            { "$Usuario.nome$": { [Sequelize.Op.like]: `%${termo}%` } },
            { "$Usuario.CPF$": { [Sequelize.Op.like]: `%${termo}%` } }
          ]
        }
      : { viagemId: cod };

    // ----- BUSCA DOS PARTICIPANTES -----
    const { count, rows } = await Participante.findAndCountAll({
      where: whereCondition,
      include: [
        { model: Usuario, include: [{ model: Genero }, { model: Endereco }] },
        { model: Acompanhante, as: "acompanhante", include: [{ model: Genero }] }
      ],
      order: [["cod", "ASC"]],
      limit,
      offset
    });

    const totalPaginas = Math.ceil(count / limit);

    const qtdParticipantes = count;
    const qtdAcompanhantes = rows.reduce((s, p) => s + (p.acompanhante ? 1 : 0), 0);
    const ocupacao = qtdParticipantes + qtdAcompanhantes;

    res.render("motorista/viagens/participantes", {
      motorista,
      viagem: await Viagem.findOne({ where: { cod }, include: [{ model: Veiculo, as: "veiculo" }] }),
      participantes: rows,
      ocupacao,
      layout: "layouts/layoutMotorista",
      paginaAtual: "viagens",
      userType: "motorista",
      paginaNun: page,
      totalPaginas,
      termoPesquisa: termo
    });

  } catch (error) {
    console.error("Erro ao buscar participantes:", error);
    res.status(500).send("Erro ao buscar participantes da viagem");
  }
};

exports.renderRelatorio = async (req, res) => {
  try {
    const codMotorista = req.session.motorista.cod;
    const motorista = await Motorista.findOne({ where: { cod: codMotorista } });

    const { cod } = req.params;
    const viagem = await Viagem.findByPk(cod, {
      include: [
        { model: CidadeConsul, as: 'cidadeconsul' },
        { model: Veiculo, as: 'veiculo' },
        { model: Motorista, as: 'Motorista' },
        { model: Status }
      ]
    });

    if (!viagem) return res.status(404).send("Viagem não encontrada");

    res.render("motorista/viagens/relatorio", { 
      motorista,
      viagem,
      layout: "layouts/layoutMotorista",
      paginaAtual: "viagens",
      userType: "motorista"
    });

  } catch (err) {
    console.error("Erro ao carregar relatório:", err);
    res.status(500).send("Erro no servidor");
  }
};

exports.salvarRelatorio = async (req, res) => {
  try {
    const { cod } = req.params;
    let { km_inicial, km_final, paradas, obs, horario_chega} = req.body;


    km_inicial = km_inicial ? Number(km_inicial) : null;
    km_final   = km_final ? Number(km_final) : null;

    paradas = paradas || null;
    obs = obs || null;
    horario_chega = horario_chega || null;
    const statusID = 3;

    await Viagem.update(
      { km_inicial, km_final, paradas, obs, horario_chega, statusID },
      { where: { cod } }
    );

    res.redirect("/motorista/viagens/index");
  } catch (err) {
    console.error("Erro ao salvar relatório:", err);
    res.status(500).send("Erro no servidor");
  }
};

