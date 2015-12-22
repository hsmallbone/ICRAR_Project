# -*- coding: utf-8 -*-
"""Telescope_performance model module."""
from sqlalchemy import *
from sqlalchemy import Table, ForeignKey, Column
from sqlalchemy.types import Integer, Float, Unicode, DateTime, LargeBinary
from sqlalchemy.orm import relationship, backref

from icrar.model import DeclarativeBase, metadata, DBSession


class Telescope_performance(DeclarativeBase):
    __tablename__ = 'telescope_performances'

    uid = Column(Integer, primary_key=True)
    beam = Column(Float, nullable=False)
    rms = Column(Float, nullable=False)
    nhi = Column(Float, nullable=False)
    ss = Column(Float, nullable=False)
    telescope_id = Column(Integer, ForeignKey('telescope.uid'), index=True)
    telescope = relationship('Telescope', uselist=False,
                        backref=backref('telescope_performances',
                                        cascade='all, delete-orphan'))


__all__ = ['Telescope_performance']
